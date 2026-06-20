"""Session — objek pusat satu sesi mengajar dan keadaannya (Dokumen Arsitektur §6.2)."""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import SessionStatus


class Session(CamelModel):
    session_id: str = Field(description="Pengenal unik sesi")
    topic_id: str = Field(description="Referensi ke Topic yang diajarkan")
    status: SessionStatus = Field(
        description="PERSIAPAN | MENGAJAR | SELESAI | EVALUASI"
    )
    created_at: str = Field(description="Waktu sesi dibuat (ISO-8601)")
    started_at: str | None = Field(default=None, description="Waktu mulai mengajar")
    ended_at: str | None = Field(default=None, description="Waktu sesi diakhiri")
    turn_count: int = Field(
        default=0, description="Jumlah giliran mengajar yang sudah berjalan"
    )
    evaluation_id: str | None = Field(
        default=None, description="Referensi ke EvaluationResult bila sudah ada"
    )
