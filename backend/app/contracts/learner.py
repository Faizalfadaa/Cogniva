"""Learner: LearnerState, Misc, LearnerResponse (Dokumen Arsitektur §6.7, §6.8).

LearnerState adalah model mental murid yang diperbarui tiap giliran. Tidak
pernah dibagikan ke Evaluator sebagai kunci jawaban (invarian §1.4).
LearnerResponse selalu dalam peran murid — bertanya, ragu, atau memparafrase.
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import DerivedFrom, LearnerResponseType


class Misc(CamelModel):
    """Satu miskonsepsi aktif yang sedang dipegang murid (§6.7)."""

    concept: str = Field(description="Konsep yang disalahpahami")
    belief: str = Field(description="Keyakinan keliru murid atas konsep itu")


class LearnerState(CamelModel):
    """Model mental murid, diperbarui tiap giliran (§6.7)."""

    session_id: str = Field(description="Sesi pemilik state")
    understood_concepts: list[str] = Field(
        default_factory=list, description="Konsep yang sudah dipahami murid"
    )
    active_misconceptions: list[Misc] = Field(
        default_factory=list, description="Miskonsepsi aktif { concept, belief }"
    )
    open_gaps: list[str] = Field(
        default_factory=list, description="Celah pemahaman yang belum terisi"
    )
    questions_asked: list[str] = Field(
        default_factory=list, description="Pertanyaan yang sudah pernah diajukan"
    )
    updated_at_turn: int = Field(
        default=0, description="Giliran terakhir yang memperbarui state"
    )


class LearnerResponse(CamelModel):
    """Keluaran Learner pada satu giliran — selalu dalam peran murid (§6.8)."""

    response_id: str = Field(description="Pengenal unik respons")
    turn_index: int = Field(description="Giliran asal respons")
    type: LearnerResponseType = Field(
        description='"question" | "confusion" | "acknowledgment" | "paraphrase"'
    )
    text: str = Field(description="Isi ucapan murid")
    target_concept: str | None = Field(
        default=None, description="Konsep yang disasar pertanyaan"
    )
    derived_from: DerivedFrom = Field(
        description='"gap" | "misconception" | "new_info"'
    )
