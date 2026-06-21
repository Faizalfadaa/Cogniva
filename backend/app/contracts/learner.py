"""Learner: LearnerState, Misc, LearnerResponse (Architecture Document §6.7, §6.8).

LearnerState is the student's mental model, updated each turn. It is never
shared with the Evaluator as an answer key (invariant §1.4). LearnerResponse
is always in the student role — asking, doubting, or paraphrasing.
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import DerivedFrom, LearnerResponseType


class Misc(CamelModel):
    """A single active misconception the student currently holds (§6.7)."""

    concept: str = Field(description="The misunderstood concept")
    belief: str = Field(description="The student's faulty belief about it")


class LearnerState(CamelModel):
    """The student's mental model, updated each turn (§6.7)."""

    session_id: str = Field(description="Session that owns the state")
    understood_concepts: list[str] = Field(
        default_factory=list, description="Concepts the student now understands"
    )
    active_misconceptions: list[Misc] = Field(
        default_factory=list, description="Active misconceptions { concept, belief }"
    )
    open_gaps: list[str] = Field(
        default_factory=list, description="Understanding gaps not yet filled"
    )
    questions_asked: list[str] = Field(
        default_factory=list, description="Questions already asked"
    )
    updated_at_turn: int = Field(
        default=0, description="Last turn that updated the state"
    )


class LearnerResponse(CamelModel):
    """The Learner's output for one turn — always in the student role (§6.8)."""

    response_id: str = Field(description="Unique response identifier")
    turn_index: int = Field(description="Turn the response came from")
    type: LearnerResponseType = Field(
        description='"question" | "confusion" | "acknowledgment" | "paraphrase"'
    )
    text: str = Field(description="The student's utterance")
    target_concept: str | None = Field(
        default=None, description="Concept the question targets"
    )
    derived_from: DerivedFrom = Field(
        description='"gap" | "misconception" | "new_info"'
    )
