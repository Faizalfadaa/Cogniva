"""Real-time session channel via WebSocket (Architecture Document §7.2).

Endpoint: /ws/sessions/{id}. Client messages are only processed when the
session status allows it (teaching_input only in TEACHING, §4.2).

M0: message-handling skeleton + status enforcement. The real teaching loop
(Vision -> ASR -> Learner) is wired up in M1/M2. Missing parts are marked TODO
and answered with a recoverable `error` message rather than a crash.
"""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..contracts.enums import SessionStatus
from ..state_machine import accepts_teaching_input
from ..store import sessions
from ..ws.messages import ErrorMessage, StateUpdate

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
        if not accepts_teaching_input(session.status):
            await _send(
                websocket,
                ErrorMessage(
                    message=f"teaching_input is only valid in TEACHING "
                    f"(current status: {session.status})"
                ),
            )
            return
        # TODO(M1/M2): forward the snapshot to Vision and audio to ASR (in
        # parallel), then call the Learner and stream learner_message back.
        await _send(
            websocket,
            ErrorMessage(message="Teaching loop not implemented yet (M1/M2)."),
        )

    elif msg_type == "confirmation_response":
        # TODO(M2): apply the correction to the uncertain interpretation, continue.
        await _send(
            websocket,
            ErrorMessage(message="Confirmation handling coming later (M2)."),
        )

    elif msg_type == "end_session":
        # Mirrors REST POST /sessions/{id}/end; same state machine.
        await _send(websocket, StateUpdate(status=SessionStatus.ENDED.value))

    else:
        await _send(
            websocket,
            ErrorMessage(message=f"Unknown message type: {msg_type!r}"),
        )


async def _send(websocket: WebSocket, message) -> None:
    await websocket.send_json(message.model_dump(by_alias=True))
