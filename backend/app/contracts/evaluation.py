"""EvaluationResult & Finding — the Evaluator's output at session end (§6.9).

Rendered by the debrief screen. The Evaluator runs once, post-session, and
receives the full transcript + the topic's referenceMaterial (§3.7).
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import FindingCategory


class Finding(CamelModel):
    """A single categorized finding (§6.9)."""

    category: FindingCategory = Field(
        description='"CORRECT" | "WRONG" | "MISSED" | "CONFUSING"'
    )
    concept: str = Field(description="Concept the finding highlights")
    detail: str = Field(description="Explanation of the finding")
    evidence_turn_index: int | None = Field(
        default=None, description="Reference to the related turn, if any"
    )


class EvaluationResult(CamelModel):
    evaluation_id: str = Field(description="Unique evaluation identifier")
    session_id: str = Field(description="Session being evaluated")
    score: int = Field(description="Overall score 0..100")
    findings: list[Finding] = Field(
        default_factory=list, description="Categorized findings"
    )
    summary: str = Field(description="Narrative summary of the evaluation")
    strengths: list[str] = Field(
        default_factory=list, description="What the explanation did well"
    )
    improvements: list[str] = Field(
        default_factory=list, description="Key suggestions for improvement"
    )
    generated_at: str = Field(description="Time the result was produced (ISO-8601)")
