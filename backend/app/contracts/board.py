"""Kanal visual: BoardSnapshot, Element, VisionInterpretation.

(Dokumen Arsitektur §6.3, §6.4). Snapshot papan ditangkap frontend, dikirim
ke backend, lalu Vision mengubahnya menjadi interpretasi terstruktur yang
menjadi masukan inti bagi Learner.
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import ElementType


class BoardSnapshot(CamelModel):
    """Tangkapan papan pada satu giliran, dikirim frontend ke backend (§6.3)."""

    snapshot_id: str = Field(description="Pengenal unik snapshot")
    session_id: str = Field(description="Sesi pemilik snapshot")
    turn_index: int = Field(description="Indeks giliran (mulai 0)")
    image: str = Field(description="Data gambar base64 atau URL objek")
    format: str = Field(description='Format gambar, mis. "png"')
    captured_at: str = Field(description="Waktu tangkap (ISO-8601)")


class Element(CamelModel):
    """Satu elemen terdeteksi pada papan (§6.4).

    bbox opsional: [x, y, w, h].
    """

    type: ElementType
    content: str
    bbox: list[float] | None = Field(
        default=None, description="Kotak pembatas [x, y, w, h]"
    )


class VisionInterpretation(CamelModel):
    """Keluaran Vision atas sebuah snapshot — masukan inti bagi Learner (§6.4).

    Ketika keyakinan di bawah ambang, needsConfirmation=true dan Vision
    menyertakan suggestedClarification, bukan menebak diam-diam (invarian §3.4).
    """

    snapshot_id: str = Field(description="Snapshot sumber")
    transcribed_text: str = Field(description="Teks hasil pembacaan papan")
    elements: list[Element] = Field(
        default_factory=list, description="Daftar elemen terdeteksi"
    )
    confidence: float = Field(description="Tingkat keyakinan 0..1")
    needs_confirmation: bool = Field(
        description="true bila keyakinan di bawah ambang"
    )
    suggested_clarification: str | None = Field(
        default=None, description="Pertanyaan klarifikasi untuk pengguna"
    )
