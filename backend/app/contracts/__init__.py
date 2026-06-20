"""Kontrak data antar-komponen Cogniva (Dokumen Arsitektur §6).

Inti keluaran Milestone M0. Semua komponen wajib mematuhi bentuk data ini.
Perubahan apa pun atas kontrak harus melalui kesepakatan dengan tech lead.
"""

from __future__ import annotations

from .base import CamelModel, utc_now_iso
from .board import BoardSnapshot, Element, VisionInterpretation
from .enums import (
    DerivedFrom,
    Difficulty,
    ElementType,
    FindingCategory,
    LearnerResponseType,
    SessionStatus,
)
from .evaluation import EvaluationResult, Finding
from .learner import LearnerResponse, LearnerState, Misc
from .session import Session
from .speech import SpeechTranscript
from .teaching import TeachingTurn
from .topic import Topic

__all__ = [
    "CamelModel",
    "utc_now_iso",
    # enums
    "SessionStatus",
    "Difficulty",
    "ElementType",
    "LearnerResponseType",
    "DerivedFrom",
    "FindingCategory",
    # models
    "Topic",
    "Session",
    "BoardSnapshot",
    "Element",
    "VisionInterpretation",
    "SpeechTranscript",
    "TeachingTurn",
    "LearnerState",
    "Misc",
    "LearnerResponse",
    "EvaluationResult",
    "Finding",
]
