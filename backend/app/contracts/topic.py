"""Topic — definisi topik beserta acuan kebenarannya (Dokumen Arsitektur §6.1).

Dikurasi di muka untuk topik demo. referenceMaterial mengalir penuh ke
Evaluator sebagai kunci jawaban; ke Learner HANYA commonMisconceptions yang
mengalir (invarian: Learner tidak memegang kunci jawaban, §1.4).
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import Difficulty


class Topic(CamelModel):
    topic_id: str = Field(description="Pengenal unik topik")
    title: str = Field(description='Judul topik, mis. "Fotosintesis"')
    description: str = Field(description="Deskripsi singkat untuk pemilihan topik")
    reference_material: str = Field(
        description="Materi rujukan (markdown) sebagai acuan kebenaran"
    )
    key_concepts: list[str] = Field(
        default_factory=list,
        description="Konsep kunci yang idealnya tersampaikan pengguna",
    )
    common_misconceptions: list[str] = Field(
        default_factory=list,
        description="Miskonsepsi umum; benih perilaku keliru Learner",
    )
    difficulty: Difficulty = Field(description='"dasar" | "menengah" | "lanjut"')
