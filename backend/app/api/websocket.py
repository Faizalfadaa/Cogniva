"""Jalur sesi real-time via WebSocket (Dokumen Arsitektur §7.2).

Endpoint: /ws/sessions/{id}. Pesan dari klien hanya diproses bila status sesi
mengizinkannya (teaching_input hanya pada MENGAJAR, §4.2).

M0: kerangka penanganan pesan + penegakan status. Loop mengajar nyata
(Vision → ASR → Learner) dirangkai pada M1/M2. Bagian yang belum ada ditandai
TODO dan dijawab dengan pesan `error` yang dapat dipulihkan, bukan crash.
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
        await _send(websocket, ErrorMessage(message="Sesi tidak ditemukan"))
        await websocket.close()
        return

    await _send(websocket, StateUpdate(status=str(session.status)))  # noqa: E501 status sudah berupa nilai string

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
        await _send(websocket, ErrorMessage(message="Sesi tidak ditemukan"))
        return

    if msg_type == "teaching_input":
        if not accepts_teaching_input(session.status):
            await _send(
                websocket,
                ErrorMessage(
                    message=f"teaching_input hanya sah pada MENGAJAR "
                    f"(status sekarang: {session.status})"
                ),
            )
            return
        # TODO(M1/M2): teruskan snapshot ke Vision & audio ke ASR (paralel),
        # lalu panggil Learner dan stream learner_message kembali.
        await _send(
            websocket,
            ErrorMessage(message="Loop mengajar belum diimplementasikan (M1/M2)."),
        )

    elif msg_type == "confirmation_response":
        # TODO(M2): terapkan koreksi interpretasi yang ragu lalu lanjutkan.
        await _send(
            websocket,
            ErrorMessage(message="Penanganan konfirmasi menyusul (M2)."),
        )

    elif msg_type == "end_session":
        # Sinkron dengan REST POST /sessions/{id}/end; mesin status sama.
        await _send(websocket, StateUpdate(status=SessionStatus.SELESAI.value))

    else:
        await _send(
            websocket,
            ErrorMessage(message=f"Tipe pesan tidak dikenal: {msg_type!r}"),
        )


async def _send(websocket: WebSocket, message) -> None:
    await websocket.send_json(message.model_dump(by_alias=True))
