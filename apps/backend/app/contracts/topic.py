"""Topic — a topic definition with its source of truth (Architecture Document §6.1).

Curated up front for demo topics. referenceMaterial flows in full to the
Evaluator as the answer key; only commonMisconceptions flow to the Learner
(invariant: the Learner never holds the answer key, §1.4).
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import Difficulty


class Topic(CamelModel):
    topic_id: str = Field(description="Unique topic identifier")
    title: str = Field(description='Topic title, e.g. "Photosynthesis"')
    description: str = Field(description="Short description for topic selection")
    reference_material: str = Field(
        description="Reference material (markdown) as the source of truth"
    )
    key_concepts: list[str] = Field(
        default_factory=list,
        description="Key concepts the user should ideally convey",
    )
    common_misconceptions: list[str] = Field(
        default_factory=list,
        description="Common misconceptions; seeds for the Learner's faulty beliefs",
    )
    difficulty: Difficulty = Field(description='"easy" | "medium" | "hard"')
