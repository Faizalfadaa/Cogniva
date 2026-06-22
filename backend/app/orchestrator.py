"""Orchestrator — stitches one teaching turn end to end (Architecture Document §3.3, §5.1).

This is the M1 critical path: receive a teaching input, read the board (Vision —
passthrough in M1), call the Learner, persist the turn, and return what to send
back. The orchestrator is the single owner of session truth; agents never call
each other directly (§2.3).

    teaching input --> [Vision] --> interpretation --+
                                                      +--> [Learner] --> response
                       (M2: [ASR] --> speech) --------+

If the board reading needs confirmation (low confidence, §5.3), the turn pauses
and asks the user instead of running the Learner.
"""

from __future__ import annotations

from dataclasses import dataclass

from . import config
from .agents import LearnerAgent, VisionAgent, seed_learner_state
from .contracts.base import utc_now_iso
from .contracts.board import BoardSnapshot, VisionInterpretation
from .contracts.learner import LearnerResponse
from .contracts.session import Session
from .contracts.teaching import TeachingTurn
from .contracts.topic import Topic
from .llm import LLMClient
from .store import sessions


@dataclass
class TurnResult:
    """Outcome of one teaching turn the orchestrator hands back to the API layer."""

    kind: str  # "learner" | "confirmation"
    interpretation: VisionInterpretation | None = None
    response: LearnerResponse | None = None
    snapshot_id: str | None = None
    suggested_clarification: str | None = None


class Orchestrator:
    def __init__(self, *, learner: LearnerAgent, vision: VisionAgent) -> None:
        self._learner = learner
        self._vision = vision

    def run_teaching_turn(
        self,
        session: Session,
        topic: Topic,
        *,
        image: str | None,
        typed_text: str | None,
    ) -> TurnResult:
        """Run one turn during MENGAJAR/TEACHING and persist it.

        Synchronous on purpose: the API layer offloads this to a worker thread
        so the (potentially slow) LLM call doesn't block the event loop.
        """
        turn_index = session.turn_count

        snapshot = BoardSnapshot(
            snapshot_id=sessions.new_id("snap"),
            session_id=session.session_id,
            turn_index=turn_index,
            image=image or "",
            format="png",
            captured_at=utc_now_iso(),
        )
        sessions.save_snapshot(snapshot)

        interpretation = self._vision.interpret(snapshot, typed_text)
        if interpretation.needs_confirmation:
            # Pause the turn and ask the user to confirm/correct (§5.3).
            return TurnResult(
                kind="confirmation",
                interpretation=interpretation,
                snapshot_id=snapshot.snapshot_id,
                suggested_clarification=interpretation.suggested_clarification,
            )

        state = sessions.get_learner_state(session.session_id) or seed_learner_state(
            session.session_id, topic.common_misconceptions, topic_title=topic.title
        )

        response, new_state = self._learner.respond(
            topic_title=topic.title,
            topic_description=topic.description,
            interpretation=interpretation,
            speech=None,  # TODO(M2): pass the ASR transcript
            state=state,
            turn_index=turn_index,
        )

        sessions.save_response(response)
        sessions.save_learner_state(new_state)
        sessions.save_turn(
            TeachingTurn(
                turn_index=turn_index,
                session_id=session.session_id,
                snapshot_id=snapshot.snapshot_id,
                interpretation=interpretation,
                speech_transcript=None,
                typed_input=typed_text,
                learner_response_id=response.response_id,
                created_at=utc_now_iso(),
            )
        )

        session.turn_count = turn_index + 1
        sessions.save_session(session)

        return TurnResult(kind="learner", interpretation=interpretation, response=response)


# --- Module-level singleton (built from config, overridable in tests) ------

_orchestrator: Orchestrator | None = None


def build_orchestrator(
    *, llm: LLMClient | None = None, use_config: bool = True
) -> Orchestrator:
    """Construct an Orchestrator. With use_config, build the LLM from env."""
    if llm is None and use_config and config.llm_available():
        llm = LLMClient(
            model=config.LEARNER_MODEL,
            max_tokens=config.LLM_MAX_TOKENS,
            timeout=config.LLM_TIMEOUT,
        )
    return Orchestrator(
        learner=LearnerAgent(llm),
        vision=VisionAgent(confidence_threshold=config.VISION_CONFIDENCE_THRESHOLD),
    )


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = build_orchestrator()
    return _orchestrator
