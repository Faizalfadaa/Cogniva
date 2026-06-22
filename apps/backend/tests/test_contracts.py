"""Data-contract tests: camelCase serialization & seed-topic loading (§6)."""

from app.contracts import EvaluationResult, Finding, Session, SessionStatus, Topic
from app.store import topics


def test_camel_case_serialization():
    session = Session(
        session_id="ses_1",
        topic_id="topic_x",
        status=SessionStatus.SETUP,
        created_at="2026-06-20T00:00:00Z",
    )
    data = session.model_dump(by_alias=True)
    assert "sessionId" in data
    assert "topicId" in data
    assert "createdAt" in data
    assert data["status"] == "SETUP"


def test_evaluation_result_matches_document_example():
    # Shape follows the JSON example in §6.9 (categories anglicized).
    result = EvaluationResult(
        evaluation_id="ev_8f2a",
        session_id="ses_41c0",
        score=78,
        findings=[
            Finding(
                category="CORRECT",
                concept="chlorophyll",
                detail="The role of chlorophyll absorbing light is explained well.",
                evidence_turn_index=2,
            )
        ],
        summary="Strong on the light reactions, weak on the dark reactions.",
        strengths=["light flow", "chlorophyll definition"],
        improvements=["add the Calvin cycle"],
        generated_at="2026-06-25T09:14:00Z",
    )
    data = result.model_dump(by_alias=True)
    assert data["findings"][0]["evidenceTurnIndex"] == 2
    assert data["score"] == 78


def test_seed_topics_loaded():
    loaded = topics.list()
    ids = {t.topic_id for t in loaded}
    assert "topic_photosynthesis" in ids
    assert len(loaded) >= 1
    for t in loaded:
        assert isinstance(t, Topic)
        assert t.reference_material  # source of truth must exist
        assert t.common_misconceptions  # seeds for the Learner's faulty beliefs
