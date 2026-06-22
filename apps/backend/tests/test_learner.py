"""Learner agent tests (Architecture Document §3.6, §6.7, §6.8).

These exercise the deterministic fallback and a fake-LLM mapping. They also
guard the core invariant surface: the Learner produces only student-role
responses and seeds state from common misconceptions.
"""

from app.agents.learner import LearnerAgent, seed_learner_state
from app.contracts.board import VisionInterpretation
from app.contracts.enums import LearnerResponseType
from app.contracts.learner import LearnerState, Misc

_STUDENT_TYPES = {t.value for t in LearnerResponseType}


def _interp(text: str) -> VisionInterpretation:
    return VisionInterpretation(
        snapshot_id="snap_1",
        transcribed_text=text,
        elements=[],
        confidence=1.0,
        needs_confirmation=False,
    )


def test_seed_state_from_misconceptions_only():
    state = seed_learner_state(
        "ses_1",
        ["O2 comes from CO2", "the dark reactions need darkness"],
        topic_title="Photosynthesis",
    )
    assert state.understood_concepts == []
    assert len(state.active_misconceptions) == 2
    assert state.active_misconceptions[0].belief == "O2 comes from CO2"
    assert state.updated_at_turn == 0


def test_fallback_stays_in_student_role():
    # No LLM configured -> deterministic fallback.
    agent = LearnerAgent(None)
    state = seed_learner_state("ses_1", ["O2 comes from CO2"], topic_title="Photosynthesis")
    response, new_state = agent.respond(
        topic_title="Photosynthesis",
        topic_description="How plants make food.",
        interpretation=_interp("Plants take in CO2 and release O2."),
        speech=None,
        state=state,
        turn_index=0,
    )
    assert response.type in _STUDENT_TYPES
    assert response.derived_from in {"gap", "misconception", "new_info"}
    assert response.text.strip()
    assert new_state.updated_at_turn == 0


def test_fallback_question_recorded_in_state():
    agent = LearnerAgent(None)
    # No misconceptions, one gap -> fallback asks a question about the gap.
    state = LearnerState(
        session_id="ses_1",
        understood_concepts=[],
        active_misconceptions=[],
        open_gaps=["the Calvin cycle"],
        questions_asked=[],
        updated_at_turn=0,
    )
    response, new_state = agent.respond(
        topic_title="Photosynthesis",
        topic_description="",
        interpretation=_interp("..."),
        speech=None,
        state=state,
        turn_index=2,
    )
    assert response.type == "question"
    assert response.text in new_state.questions_asked
    assert new_state.updated_at_turn == 2


class _FakeLLM:
    """Stands in for LLMClient, returning a canned structured object."""

    def __init__(self, payload: dict) -> None:
        self._payload = payload
        self.calls: list[dict] = []

    def structured(self, *, system: str, user: str, schema: dict) -> dict:
        self.calls.append({"system": system, "user": user})
        return self._payload


def test_llm_mapping_to_contracts():
    payload = {
        "response": {
            "type": "question",
            "text": "If O2 comes from CO2, why do we need water at all?",
            "targetConcept": "source of oxygen",
            "derivedFrom": "misconception",
        },
        "understoodConcepts": ["plants need light"],
        "activeMisconceptions": [
            {"concept": "source of oxygen", "belief": "O2 comes from CO2"}
        ],
        "openGaps": ["the Calvin cycle"],
    }
    fake = _FakeLLM(payload)
    agent = LearnerAgent(fake)
    state = seed_learner_state("ses_1", ["O2 comes from CO2"], topic_title="Photosynthesis")

    response, new_state = agent.respond(
        topic_title="Photosynthesis",
        topic_description="How plants make food.",
        interpretation=_interp("Water is split in the light reactions."),
        speech=None,
        state=state,
        turn_index=1,
    )

    assert response.type == "question"
    assert response.target_concept == "source of oxygen"
    assert response.derived_from == "misconception"
    assert new_state.understood_concepts == ["plants need light"]
    assert new_state.active_misconceptions[0].belief == "O2 comes from CO2"
    assert new_state.open_gaps == ["the Calvin cycle"]
    assert response.text in new_state.questions_asked
    assert new_state.updated_at_turn == 1

    # The answer key must never reach the Learner: the prompt the agent built
    # should not contain reference material / key concepts (only what we passed).
    assert "Calvin cycle" not in fake.calls[0]["system"]


def test_llm_failure_falls_back():
    class _BoomLLM:
        def structured(self, **_):  # noqa: ANN003
            raise RuntimeError("network down")

    agent = LearnerAgent(_BoomLLM())
    state = seed_learner_state("ses_1", ["O2 comes from CO2"], topic_title="Photosynthesis")
    response, _ = agent.respond(
        topic_title="Photosynthesis",
        topic_description="",
        interpretation=_interp("..."),
        speech=None,
        state=state,
        turn_index=0,
    )
    # Did not crash; produced a student-role response via the fallback.
    assert response.type in _STUDENT_TYPES
