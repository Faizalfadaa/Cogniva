"""EvaluationResult & Finding — keluaran Evaluator di akhir sesi (§6.9).

Dirender oleh layar debrief. Evaluator berjalan sekali, pasca-sesi, dan
menerima transkrip lengkap + referenceMaterial topik (§3.7).
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import FindingCategory


class Finding(CamelModel):
    """Satu temuan terkategori (§6.9)."""

    category: FindingCategory = Field(
        description='"BENAR" | "KELIRU" | "TERLEWAT" | "MEMBINGUNGKAN"'
    )
    concept: str = Field(description="Konsep yang disorot temuan")
    detail: str = Field(description="Penjelasan temuan")
    evidence_turn_index: int | None = Field(
        default=None, description="Rujukan ke giliran terkait jika ada"
    )


class EvaluationResult(CamelModel):
    evaluation_id: str = Field(description="Pengenal unik hasil evaluasi")
    session_id: str = Field(description="Sesi yang dinilai")
    score: int = Field(description="Skor keseluruhan 0..100")
    findings: list[Finding] = Field(
        default_factory=list, description="Temuan terkategori"
    )
    summary: str = Field(description="Ringkasan naratif penilaian")
    strengths: list[str] = Field(
        default_factory=list, description="Hal yang sudah baik dari penjelasan"
    )
    improvements: list[str] = Field(
        default_factory=list, description="Saran perbaikan utama"
    )
    generated_at: str = Field(description="Waktu hasil dibuat (ISO-8601)")
