"""Controlled enumerations used across the contracts (Architecture Document §4, §6).

Enum values are anglicized for an international audience. Mapping back to the
Indonesian architecture PDF (agreed contract change):

    SessionStatus:    PERSIAPAN->SETUP, MENGAJAR->TEACHING,
                      SELESAI->ENDED, EVALUASI->EVALUATED
    Difficulty:       dasar->easy, menengah->medium, lanjut->hard
    FindingCategory:  BENAR->CORRECT, KELIRU->WRONG,
                      TERLEWAT->MISSED, MEMBINGUNGKAN->CONFUSING
"""

from __future__ import annotations

from enum import Enum


class SessionStatus(str, Enum):
    """The four sequential session states (§4.1). Forward-only, no going back."""

    SETUP = "SETUP"  # topic chosen, session created, not teaching yet
    TEACHING = "TEACHING"  # teaching-turn loop active; snapshots flow
    ENDED = "ENDED"  # session ended, transcript locked, awaiting evaluation
    EVALUATED = "EVALUATED"  # evaluator ran; results available


class Difficulty(str, Enum):
    """Topic difficulty level (§6.1)."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ElementType(str, Enum):
    """Kinds of element Vision can detect on the board (§6.4)."""

    TEXT = "text"
    EQUATION = "equation"
    DIAGRAM = "diagram"
    ARROW = "arrow"
    FIGURE = "figure"


class LearnerResponseType(str, Enum):
    """Kinds of learner utterance — always in the student role (§6.8)."""

    QUESTION = "question"
    CONFUSION = "confusion"
    ACKNOWLEDGMENT = "acknowledgment"
    PARAPHRASE = "paraphrase"


class DerivedFrom(str, Enum):
    """What triggered the learner's response (§6.8)."""

    GAP = "gap"
    MISCONCEPTION = "misconception"
    NEW_INFO = "new_info"


class FindingCategory(str, Enum):
    """Evaluation finding categories (§6.9)."""

    CORRECT = "CORRECT"
    WRONG = "WRONG"
    MISSED = "MISSED"
    CONFUSING = "CONFUSING"
