"""Learner agent — the heart of learning-by-teaching (Architecture Document §3.6).

The Learner role-plays a novice student. Each turn it compares what the teacher
just explained against its current (deliberately imperfect) mental model and
responds in-character: a naive question, an expression of confusion, or a
paraphrase. It then updates its LearnerState.

INVARIANTS ENFORCED HERE (§1.4):
- The Learner stays in the student role; it never corrects, grades, or teaches.
- It never holds the answer key. This function only ever receives the topic
  title/description, what was explained, and its own state — never the topic's
  referenceMaterial or keyConcepts.
- Initial state is seeded from the topic's commonMisconceptions only.

If no LLM is configured, a deterministic fallback keeps the loop running so the
end-to-end skeleton works without an API key.
"""

from __future__ import annotations

import logging

from ..contracts.board import VisionInterpretation
from ..contracts.learner import LearnerResponse, LearnerState, Misc
from ..contracts.speech import SpeechTranscript
from ..llm import LLMClient
from ..store import sessions

logger = logging.getLogger("cogniva.learner")

_MAX_SEED_MISCONCEPTIONS = 3

# Structured-output schema for one student turn (camelCase, structured-outputs
# compliant: every object closed, every property required).
_OUTPUT_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "response": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["question", "confusion", "acknowledgment", "paraphrase"],
                },
                "text": {"type": "string"},
                "targetConcept": {"type": "string"},
                "derivedFrom": {
                    "type": "string",
                    "enum": ["gap", "misconception", "new_info"],
                },
            },
            "required": ["type", "text", "targetConcept", "derivedFrom"],
        },
        "understoodConcepts": {"type": "array", "items": {"type": "string"}},
        "activeMisconceptions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "concept": {"type": "string"},
                    "belief": {"type": "string"},
                },
                "required": ["concept", "belief"],
            },
        },
        "openGaps": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "response",
        "understoodConcepts",
        "activeMisconceptions",
        "openGaps",
    ],
}

_SYSTEM_PROMPT = """\
You are role-playing as a NOVICE STUDENT who is being taught about "{title}" by \
the user, who is the teacher. {description}

Stay strictly in the student role for the entire session:
- You are a beginner. You do NOT understand the material well yet.
- NEVER teach, correct, grade, explain back authoritatively, or reveal the \
correct answer. A real beginner would not know it.
- React to what the teacher just explained by doing exactly ONE of: asking a \
naive question, expressing genuine confusion, or paraphrasing your \
(possibly flawed) understanding to check it.
- Reason from your CURRENT understanding, including any misconceptions you \
currently hold. Let those misconceptions surface naturally as plausible \
beginner beliefs or questions, so the teacher has something real to address.
- Use ONLY what the teacher has actually explained plus your current beginner \
understanding. Do not pull in outside expert knowledge to fill gaps.

After responding, update your mental model to reflect this turn: what you now \
understand, which misconceptions you still hold (or have dropped), and which \
gaps remain. Keep it realistic for a beginner — do not suddenly understand \
everything.

Reply with ONLY the JSON object required by the response schema."""


def seed_learner_state(
    session_id: str,
    common_misconceptions: list[str],
    *,
    topic_title: str,
) -> LearnerState:
    """Seed the initial mental model from the topic's common misconceptions (§3.6).

    Only commonMisconceptions flow to the Learner — never the answer key.
    """
    misconceptions = [
        Misc(concept=topic_title, belief=text)
        for text in common_misconceptions[:_MAX_SEED_MISCONCEPTIONS]
    ]
    return LearnerState(
        session_id=session_id,
        understood_concepts=[],
        active_misconceptions=misconceptions,
        open_gaps=[],
        questions_asked=[],
        updated_at_turn=0,
    )


class LearnerAgent:
    """Produces a student response + updated state for one teaching turn."""

    def __init__(self, llm: LLMClient | None) -> None:
        self._llm = llm

    def respond(
        self,
        *,
        topic_title: str,
        topic_description: str,
        interpretation: VisionInterpretation,
        speech: SpeechTranscript | None,
        state: LearnerState,
        turn_index: int,
    ) -> tuple[LearnerResponse, LearnerState]:
        if self._llm is not None:
            try:
                return self._respond_with_llm(
                    topic_title=topic_title,
                    topic_description=topic_description,
                    interpretation=interpretation,
                    speech=speech,
                    state=state,
                    turn_index=turn_index,
                )
            except Exception as exc:  # noqa: BLE001 - never crash the teaching loop
                logger.warning("Learner LLM failed; using fallback: %s", exc)
        return self._fallback(state=state, turn_index=turn_index)

    # --- LLM path ----------------------------------------------------------

    def _respond_with_llm(
        self,
        *,
        topic_title: str,
        topic_description: str,
        interpretation: VisionInterpretation,
        speech: SpeechTranscript | None,
        state: LearnerState,
        turn_index: int,
    ) -> tuple[LearnerResponse, LearnerState]:
        system = _SYSTEM_PROMPT.format(
            title=topic_title, description=topic_description or ""
        )
        user = _build_user_prompt(interpretation, speech, state)
        data = self._llm.structured(system=system, user=user, schema=_OUTPUT_SCHEMA)

        raw = data["response"]
        target = (raw.get("targetConcept") or "").strip() or None
        response = LearnerResponse(
            response_id=sessions.new_id("resp"),
            turn_index=turn_index,
            type=raw["type"],
            text=raw["text"],
            target_concept=target,
            derived_from=raw["derivedFrom"],
        )

        asked = list(state.questions_asked)
        if response.type == "question":
            asked.append(response.text)
        new_state = LearnerState(
            session_id=state.session_id,
            understood_concepts=list(data.get("understoodConcepts", [])),
            active_misconceptions=[
                Misc(concept=m["concept"], belief=m["belief"])
                for m in data.get("activeMisconceptions", [])
            ],
            open_gaps=list(data.get("openGaps", [])),
            questions_asked=asked,
            updated_at_turn=turn_index,
        )
        return response, new_state

    # --- Deterministic fallback (no LLM configured) ------------------------

    def _fallback(
        self, *, state: LearnerState, turn_index: int
    ) -> tuple[LearnerResponse, LearnerState]:
        if state.active_misconceptions:
            misc = state.active_misconceptions[0]
            response = LearnerResponse(
                response_id=sessions.new_id("resp"),
                turn_index=turn_index,
                type="confusion",
                text=(
                    f"Wait, I'm a bit confused about {misc.concept}. I had it in "
                    f'my head that "{misc.belief}" — did I get that wrong?'
                ),
                target_concept=misc.concept,
                derived_from="misconception",
            )
        elif state.open_gaps:
            gap = state.open_gaps[0]
            response = LearnerResponse(
                response_id=sessions.new_id("resp"),
                turn_index=turn_index,
                type="question",
                text=f"I don't think I follow the part about {gap}. Could you explain that again?",
                target_concept=gap,
                derived_from="gap",
            )
        else:
            response = LearnerResponse(
                response_id=sessions.new_id("resp"),
                turn_index=turn_index,
                type="confusion",
                text=(
                    "Hmm, I think I followed some of that, but I'm a little lost. "
                    "Could you go over it once more, a bit more slowly?"
                ),
                target_concept=None,
                derived_from="new_info",
            )

        asked = list(state.questions_asked)
        if response.type == "question":
            asked.append(response.text)
        new_state = LearnerState(
            session_id=state.session_id,
            understood_concepts=list(state.understood_concepts),
            active_misconceptions=list(state.active_misconceptions),
            open_gaps=list(state.open_gaps),
            questions_asked=asked,
            updated_at_turn=turn_index,
        )
        return response, new_state


def _build_user_prompt(
    interpretation: VisionInterpretation,
    speech: SpeechTranscript | None,
    state: LearnerState,
) -> str:
    parts: list[str] = []
    parts.append(
        "What the teacher just put on the board / notes:\n"
        + (interpretation.transcribed_text or "(nothing legible)")
    )
    if speech is not None and speech.transcript:
        parts.append("What the teacher said out loud:\n" + speech.transcript)

    understood = ", ".join(state.understood_concepts) or "(nothing yet)"
    misconceptions = (
        "; ".join(f"{m.concept}: {m.belief}" for m in state.active_misconceptions)
        or "(none recorded)"
    )
    gaps = ", ".join(state.open_gaps) or "(none recorded)"
    parts.append(
        "Your current mental model as the student:\n"
        f"- Concepts you feel you understand: {understood}\n"
        f"- Misconceptions you currently hold: {misconceptions}\n"
        f"- Gaps you're unsure about: {gaps}"
    )
    parts.append(
        "Respond as the student for this turn, then return your updated mental model."
    )
    return "\n\n".join(parts)
