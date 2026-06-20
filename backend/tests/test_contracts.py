"""Uji kontrak data: serialisasi camelCase & pemuatan topik seed (§6)."""

from app.contracts import EvaluationResult, Finding, Session, SessionStatus, Topic
from app.store import topics


def test_serialisasi_camel_case():
    session = Session(
        session_id="ses_1",
        topic_id="topic_x",
        status=SessionStatus.PERSIAPAN,
        created_at="2026-06-20T00:00:00Z",
    )
    data = session.model_dump(by_alias=True)
    assert "sessionId" in data
    assert "topicId" in data
    assert "createdAt" in data
    assert data["status"] == "PERSIAPAN"


def test_evaluation_result_contoh_dokumen():
    # Bentuk mengikuti contoh JSON §6.9.
    result = EvaluationResult(
        evaluation_id="ev_8f2a",
        session_id="ses_41c0",
        score=78,
        findings=[
            Finding(
                category="BENAR",
                concept="klorofil",
                detail="Peran klorofil menyerap cahaya dijelaskan tepat.",
                evidence_turn_index=2,
            )
        ],
        summary="Penjelasan kuat di tahap terang, lemah di tahap gelap.",
        strengths=["alur cahaya", "definisi klorofil"],
        improvements=["tambahkan siklus Calvin"],
        generated_at="2026-06-25T09:14:00Z",
    )
    data = result.model_dump(by_alias=True)
    assert data["findings"][0]["evidenceTurnIndex"] == 2
    assert data["score"] == 78


def test_topik_seed_termuat():
    loaded = topics.list()
    ids = {t.topic_id for t in loaded}
    assert "topic_fotosintesis" in ids
    assert len(loaded) >= 1
    for t in loaded:
        assert isinstance(t, Topic)
        assert t.reference_material  # acuan kebenaran wajib ada
        assert t.common_misconceptions  # benih perilaku keliru Learner
