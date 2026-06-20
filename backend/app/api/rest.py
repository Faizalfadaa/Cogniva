"""Endpoint REST untuk siklus hidup sesi & pengambilan data (Dokumen Arsitektur §7.1).

Awalan jalur adalah /api. Mesin status sesi (§4) ditegakkan di sini.
Pemanggilan agen (Vision/Learner/Evaluator) masih stub untuk M0 — diisi pada
M1+. Pemicuan evaluasi bersifat idempoten (§4.2): memanggil dua kali atas sesi
yang sama mengembalikan hasil yang sama, bukan menjalankan Evaluator ulang.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..contracts.base import utc_now_iso
from ..contracts.enums import SessionStatus
from ..contracts.evaluation import EvaluationResult
from ..contracts.session import Session
from ..contracts.topic import Topic
from ..state_machine import END, EVALUATE, START, InvalidTransition, next_status
from ..store import sessions, topics

router = APIRouter(prefix="/api")


class CreateSessionRequest(BaseModel):
    topicId: str


# --- Topik -----------------------------------------------------------------


@router.get("/topics", response_model=list[Topic])
def list_topics() -> list[Topic]:
    """Daftar topik demo tersedia."""
    return topics.list()


@router.get("/topics/{topic_id}", response_model=Topic)
def get_topic(topic_id: str) -> Topic:
    """Detail satu topik."""
    topic = topics.get(topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="Topik tidak ditemukan")
    return topic


# --- Siklus hidup sesi -----------------------------------------------------


@router.post("/sessions", response_model=Session, status_code=201)
def create_session(req: CreateSessionRequest) -> Session:
    """Membuat sesi baru atas sebuah topicId → Session (PERSIAPAN)."""
    if topics.get(req.topicId) is None:
        raise HTTPException(status_code=404, detail="Topik tidak ditemukan")
    session = Session(
        session_id=sessions.new_id("ses"),
        topic_id=req.topicId,
        status=SessionStatus.PERSIAPAN,
        created_at=utc_now_iso(),
    )
    return sessions.save_session(session)


@router.get("/sessions/{session_id}", response_model=Session)
def get_session(session_id: str) -> Session:
    """Mengambil keadaan sesi."""
    return _require_session(session_id)


@router.post("/sessions/{session_id}/start", response_model=Session)
def start_session(session_id: str) -> Session:
    """Memulai mengajar → Session (MENGAJAR)."""
    session = _require_session(session_id)
    _advance(session, START)
    session.started_at = utc_now_iso()
    return sessions.save_session(session)


@router.post("/sessions/{session_id}/end", response_model=Session)
def end_session(session_id: str) -> Session:
    """Mengakhiri sesi → Session (SELESAI). Transkrip terkunci."""
    session = _require_session(session_id)
    _advance(session, END)
    session.ended_at = utc_now_iso()
    return sessions.save_session(session)


@router.post("/sessions/{session_id}/evaluate", response_model=EvaluationResult)
def evaluate_session(session_id: str) -> EvaluationResult:
    """Memicu Evaluator (idempoten). Pasca-sesi saja (§3.7, §4.2).

    M0: mengembalikan hasil placeholder bila belum ada. Logika Evaluator nyata
    menyusul di M3.
    """
    session = _require_session(session_id)

    existing = sessions.get_evaluation_by_session(session_id)
    if existing is not None:
        return existing  # idempoten: jangan jalankan Evaluator ulang

    if session.status == SessionStatus.SELESAI:
        _advance(session, EVALUATE)

    # TODO(M3): panggil Evaluator nyata dengan transkrip + referenceMaterial.
    result = EvaluationResult(
        evaluation_id=sessions.new_id("ev"),
        session_id=session_id,
        score=0,
        findings=[],
        summary="Evaluator belum diimplementasikan (placeholder M0).",
        strengths=[],
        improvements=[],
        generated_at=utc_now_iso(),
    )
    sessions.save_evaluation(result)
    session.evaluation_id = result.evaluation_id
    sessions.save_session(session)
    return result


@router.get("/sessions/{session_id}/evaluation", response_model=EvaluationResult)
def get_evaluation(session_id: str) -> EvaluationResult:
    """Mengambil hasil penilaian."""
    _require_session(session_id)
    result = sessions.get_evaluation_by_session(session_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Evaluasi belum tersedia")
    return result


# --- Pembantu --------------------------------------------------------------


def _require_session(session_id: str) -> Session:
    session = sessions.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    return session


def _advance(session: Session, event: str) -> None:
    try:
        session.status = next_status(session.status, event)
    except InvalidTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
