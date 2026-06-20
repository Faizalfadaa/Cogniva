"""Kontrak pesan WebSocket (Dokumen Arsitektur §7.2).

Jalur sesi real-time memakai WebSocket pada /ws/sessions/{id}. Setiap pesan
membawa field `type`. Pesan dari klien ke server hanya diproses bila status
sesi mengizinkannya (mis. teaching_input hanya pada MENGAJAR).
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from ..contracts.base import CamelModel
from ..contracts.board import VisionInterpretation
from ..contracts.learner import LearnerResponse
from ..contracts.speech import SpeechTranscript

# --- Klien -> Server -------------------------------------------------------


class TeachingInput(CamelModel):
    """{ image, audio?, typedText? } — kirim giliran (saat MENGAJAR)."""

    type: Literal["teaching_input"] = "teaching_input"
    image: str = Field(description="Snapshot papan: base64 atau URL")
    audio: str | None = Field(default=None, description="Klip suara pengajar")
    typed_text: str | None = Field(default=None, description="Teks ketikan opsional")


class ConfirmationResponse(CamelModel):
    """{ snapshotId, corrected } — koreksi interpretasi yang ragu."""

    type: Literal["confirmation_response"] = "confirmation_response"
    snapshot_id: str
    corrected: str = Field(description="Teks interpretasi yang dikoreksi pengguna")


class EndSession(CamelModel):
    """Minta akhiri sesi."""

    type: Literal["end_session"] = "end_session"


# --- Server -> Klien -------------------------------------------------------


class VisionResult(CamelModel):
    """{ interpretation } — hasil pembacaan papan."""

    type: Literal["vision_result"] = "vision_result"
    interpretation: VisionInterpretation


class SpeechResult(CamelModel):
    """{ transcript } — transkrip ucapan pengajar."""

    type: Literal["speech_result"] = "speech_result"
    transcript: SpeechTranscript


class ConfirmationRequest(CamelModel):
    """{ snapshotId, suggestedClarification } — minta konfirmasi."""

    type: Literal["confirmation_request"] = "confirmation_request"
    snapshot_id: str
    suggested_clarification: str


class LearnerMessage(CamelModel):
    """{ response } — ucapan murid (di-stream)."""

    type: Literal["learner_message"] = "learner_message"
    response: LearnerResponse


class StateUpdate(CamelModel):
    """{ status } — perubahan status sesi."""

    type: Literal["state_update"] = "state_update"
    status: str


class ErrorMessage(CamelModel):
    """{ message } — galat dapat dipulihkan."""

    type: Literal["error"] = "error"
    message: str
