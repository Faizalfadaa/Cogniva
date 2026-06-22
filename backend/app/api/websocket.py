"""Real-time session channel via WebSocket (Architecture Document §7.2).

Endpoint: /ws/sessions/{id}. Client messages are only processed when the
session status allows it (teaching_input only in TEACHING, §4.2).

M1 wires the core teaching loop: a teaching_input runs one full turn through the
orchestrator (Vision passthrough -> Learner) and streams back the board reading
plus the student's response. Real Vision/ASR land in M2.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..contracts.enums import SessionStatus
from ..orchestrator import TurnResult, get_orchestrator
from ..state_machine import accepts_teaching_input
from ..store import sessions, topics
from ..ws.messages import (
    ConfirmationRequest,
    ErrorMessage,
    LearnerMessage,
    StateUpdate,
    VisionResult,
)

logger = logging.getLogger("cogniva.ws")
router = APIRouter()


@router.websocket("/ws/sessions/{session_id}")
async def session_socket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()

    session = sessions.get_session(session_id)
    if session is None:
        await _send(websocket, ErrorMessage(message="Session not found"))
        await websocket.close()
        return

    await _send(websocket, StateUpdate(status=str(session.status)))

    try:
        while True:
            payload = await websocket.receive_json()
            await _handle(websocket, session_id, payload)
    except WebSocketDisconnect:
        return


async def _handle(websocket: WebSocket, session_id: str, payload: dict) -> None:
    msg_type = payload.get("type")
    session = sessions.get_session(session_id)
    if session is None:
        await _send(websocket, ErrorMessage(message="Session not found"))
        return

    if msg_type == "teaching_input":
        await _run_turn(
            websocket,
            session_id,
            image=payload.get("image"),
            typed_text=payload.get("typedText"),
        )

    elif msg_type == "confirmation_response":
        # The user corrected an uncertain board reading; rerun the turn with it.
        await _run_turn(
            websocket,
            session_id,
            image=None,
            typed_text=payload.get("corrected"),
        )

    elif msg_type == "end_session":
        # Mirrors REST POST /sessions/{id}/end; same state machine.
        await _send(websocket, StateUpdate(status=SessionStatus.ENDED.value))

    else:
        await _send(
            websocket,
            ErrorMessage(message=f"Unknown message type: {msg_type!r}"),
        )


async def _run_turn(
    websocket: WebSocket,
    session_id: str,
    *,
    image: str | None,
    typed_text: str | None,
) -> None:
    session = sessions.get_session(session_id)
    if session is None:
        await _send(websocket, ErrorMessage(message="Session not found"))
        return
    if not accepts_teaching_input(session.status):
        await _send(
            websocket,
            ErrorMessage(
                message=f"teaching_input is only valid in TEACHING "
                f"(current status: {session.status})"
            ),
        )
        return
    topic = topics.get(session.topic_id)
    if topic is None:
        await _send(websocket, ErrorMessage(message="Topic not found for session"))
        return

    try:
        # Offload the (potentially slow) LLM-backed turn to a worker thread so
        # the event loop stays responsive.
        result: TurnResult = await asyncio.to_thread(
            get_orchestrator().run_teaching_turn,
            session,
            topic,
            image=image,
            typed_text=typed_text,
        )
    except Exception as exc:  # noqa: BLE001 - keep the socket alive on failure
        logger.exception("Teaching turn failed")
        await _send(websocket, ErrorMessage(message=f"Teaching turn failed: {exc}"))
        return

    if result.kind == "confirmation":
        await _send(
            websocket,
            ConfirmationRequest(
                snapshot_id=result.snapshot_id or "",
                suggested_clarification=result.suggested_clarification or "",
            ),
        )
        return

    if result.interpretation is not None:
        await _send(websocket, VisionResult(interpretation=result.interpretation))
    if result.response is not None:
        await _send(websocket, LearnerMessage(response=result.response))


async def _send(websocket: WebSocket, message) -> None:
    await websocket.send_json(message.model_dump(by_alias=True))
