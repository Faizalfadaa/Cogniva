"""REST endpoints for the session lifecycle & data retrieval (Architecture Document §7.1).

The path prefix is /api. The session state machine (§4) is enforced here.
Agent calls (Vision/Learner/Evaluator) are still stubs for M0 — filled in at
M1+. Triggering evaluation is idempotent (§4.2): calling it twice for the same
session returns the same result rather than re-running the Evaluator.
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


# --- Topics ----------------------------------------------------------------


@router.get("/topics", response_model=list[Topic])
def list_topics() -> list[Topic]:
    """List the available demo topics."""
    return topics.list()


@router.get("/topics/{topic_id}", response_model=Topic)
def get_topic(topic_id: str) -> Topic:
    """Details of a single topic."""
    topic = topics.get(topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


# --- Session lifecycle -----------------------------------------------------


@router.post("/sessions", response_model=Session, status_code=201)
def create_session(req: CreateSessionRequest) -> Session:
    """Create a new session for a topicId -> Session (SETUP)."""
    if topics.get(req.topicId) is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    session = Session(
        session_id=sessions.new_id("ses"),
        topic_id=req.topicId,
        status=SessionStatus.SETUP,
        created_at=utc_now_iso(),
    )
    return sessions.save_session(session)


@router.get("/sessions/{session_id}", response_model=Session)
def get_session(session_id: str) -> Session:
    """Get the session state."""
    return _require_session(session_id)


@router.post("/sessions/{session_id}/start", response_model=Session)
def start_session(session_id: str) -> Session:
    """Start teaching -> Session (TEACHING)."""
    session = _require_session(session_id)
    _advance(session, START)
    session.started_at = utc_now_iso()
    return sessions.save_session(session)


@router.post("/sessions/{session_id}/end", response_model=Session)
def end_session(session_id: str) -> Session:
    """End the session -> Session (ENDED). The transcript is locked."""
    session = _require_session(session_id)
    _advance(session, END)
    session.ended_at = utc_now_iso()
    return sessions.save_session(session)


@router.post("/sessions/{session_id}/evaluate", response_model=EvaluationResult)
def evaluate_session(session_id: str) -> EvaluationResult:
    """Trigger the Evaluator (idempotent). Post-session only (§3.7, §4.2).

    M0: returns a placeholder result if none exists yet. The real Evaluator
    logic comes in M3.
    """
    session = _require_session(session_id)

    existing = sessions.get_evaluation_by_session(session_id)
    if existing is not None:
        return existing  # idempotent: do not re-run the Evaluator

    if session.status == SessionStatus.ENDED:
        _advance(session, EVALUATE)

    # TODO(M3): call the real Evaluator with the transcript + referenceMaterial.
    result = EvaluationResult(
        evaluation_id=sessions.new_id("ev"),
        session_id=session_id,
        score=0,
        findings=[],
        summary="Evaluator not implemented yet (M0 placeholder).",
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
    """Get the evaluation result."""
    _require_session(session_id)
    result = sessions.get_evaluation_by_session(session_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Evaluation not available yet")
    return result


# --- Helpers ---------------------------------------------------------------


def _require_session(session_id: str) -> Session:
    session = sessions.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _advance(session: Session, event: str) -> None:
    try:
        session.status = next_status(session.status, event)
    except InvalidTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
