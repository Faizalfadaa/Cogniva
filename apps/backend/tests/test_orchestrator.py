"""Orchestrator tests (Architecture Document §3.3, §5.1) — one full teaching turn."""

from app.agents import VisionAgent
from app.contracts.base import utc_now_iso
from app.contracts.enums import SessionStatus
from app.contracts.learner import LearnerResponse, LearnerState
from app.contracts.session import Session
from app.orchestrator import Orchestrator
from app.store import sessions, topics


class _FakeLearner:
    def respond(self, *, state, turn_index, **_):  # noqa: ANN003
        response = LearnerResponse(
            response_id=sessions.new_id("resp"),
            turn_index=turn_index,
            type="question",
            text="Why does that happen?",
            target_concept=None,
            derived_from="new_info",
        )
        new_state = LearnerState(
            session_id=state.session_id,
            understood_concepts=[],
            active_misconceptions=list(state.active_misconceptions),
            open_gaps=[],
            questions_asked=[response.text],
            updated_at_turn=turn_index,
        )
        return response, new_state


def _new_session() -> Session:
    session = Session(
        session_id=sessions.new_id("ses"),
        topic_id="topic_photosynthesis",
        status=SessionStatus.TEACHING,
        created_at=utc_now_iso(),
        turn_count=0,
    )
    return sessions.save_session(session)


def _orchestrator() -> Orchestrator:
    return Orchestrator(
        learner=_FakeLearner(),
        vision=VisionAgent(confidence_threshold=0.6),
    )


def test_full_turn_persists_and_advances():
    session = _new_session()
    topic = topics.get("topic_photosynthesis")
    orch = _orchestrator()

    result = orch.run_teaching_turn(
        session, topic, image=None, typed_text="Plants turn light into sugar."
    )

    assert result.kind == "learner"
    assert result.response is not None
    assert result.interpretation.transcribed_text == "Plants turn light into sugar."

    # Turn was persisted and the counter advanced.
    assert session.turn_count == 1
    turns = sessions.list_turns(session.session_id)
    assert len(turns) == 1
    assert turns[0].learner_response_id == result.response.response_id
    assert sessions.get_response(result.response.response_id) is not None
    assert sessions.get_learner_state(session.session_id) is not None


def test_image_only_requests_confirmation():
    session = _new_session()
    topic = topics.get("topic_photosynthesis")
    orch = _orchestrator()

    # No typed text + only an image -> Vision (M1 stub) can't read it yet.
    result = orch.run_teaching_turn(
        session, topic, image="base64data", typed_text=None
    )

    assert result.kind == "confirmation"
    assert result.snapshot_id
    assert result.suggested_clarification
    # No learner turn ran, so the counter did not advance.
    assert session.turn_count == 0
    assert sessions.list_turns(session.session_id) == []
