"""TeachingTurn — satu rekaman giliran mengajar (Dokumen Arsitektur §6.6).

Rangkaian objek inilah yang menyusun transkrip. Tiap giliran menggabungkan
kanal papan (snapshot + interpretasi) dan kanal suara (transkrip ucapan).
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .board import VisionInterpretation
from .speech import SpeechTranscript


class TeachingTurn(CamelModel):
    turn_index: int = Field(description="Indeks giliran dalam sesi")
    session_id: str = Field(description="Sesi pemilik giliran")
    snapshot_id: str = Field(description="Snapshot papan giliran ini")
    interpretation: VisionInterpretation = Field(description="Hasil pembacaan papan")
    speech_transcript: SpeechTranscript | None = Field(
        default=None, description="Transkrip ucapan pengajar giliran ini"
    )
    typed_input: str | None = Field(
        default=None, description="Teks ketikan opsional (pelengkap/fallback)"
    )
    learner_response_id: str = Field(description="Referensi ke respons Learner")
    created_at: str = Field(description="Waktu giliran (ISO-8601)")
