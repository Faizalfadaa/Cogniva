"""Cogniva inter-component data contracts (Architecture Document §6).

The core output of Milestone M0. Every component must conform to these data
shapes. Any change to the contracts must be agreed with the tech lead.
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
