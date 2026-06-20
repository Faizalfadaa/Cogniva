"""Enumerasi terkontrol yang dipakai lintas kontrak (Dokumen Arsitektur §4, §6)."""

from __future__ import annotations

from enum import Enum


class SessionStatus(str, Enum):
    """Empat status sesi yang berurutan (§4.1). Hanya maju, tidak mundur."""

    PERSIAPAN = "PERSIAPAN"
    MENGAJAR = "MENGAJAR"
    SELESAI = "SELESAI"
    EVALUASI = "EVALUASI"


class Difficulty(str, Enum):
    """Tingkat kesulitan topik (§6.1)."""

    DASAR = "dasar"
    MENENGAH = "menengah"
    LANJUT = "lanjut"


class ElementType(str, Enum):
    """Jenis elemen yang terdeteksi Vision pada papan (§6.4)."""

    TEXT = "text"
    EQUATION = "equation"
    DIAGRAM = "diagram"
    ARROW = "arrow"
    FIGURE = "figure"


class LearnerResponseType(str, Enum):
    """Jenis ucapan murid — selalu dalam peran murid (§6.8)."""

    QUESTION = "question"
    CONFUSION = "confusion"
    ACKNOWLEDGMENT = "acknowledgment"
    PARAPHRASE = "paraphrase"


class DerivedFrom(str, Enum):
    """Asal pemicu respons Learner (§6.8)."""

    GAP = "gap"
    MISCONCEPTION = "misconception"
    NEW_INFO = "new_info"


class FindingCategory(str, Enum):
    """Kategori temuan evaluasi (§6.9)."""

    BENAR = "BENAR"
    KELIRU = "KELIRU"
    TERLEWAT = "TERLEWAT"
    MEMBINGUNGKAN = "MEMBINGUNGKAN"
