"""Visual channel: BoardSnapshot, Element, VisionInterpretation.

(Architecture Document §6.3, §6.4). The board snapshot is captured by the
frontend, sent to the backend, then Vision turns it into a structured
interpretation that becomes the core input for the Learner.
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import ElementType


class BoardSnapshot(CamelModel):
    """A board capture for one turn, sent from frontend to backend (§6.3)."""

    snapshot_id: str = Field(description="Unique snapshot identifier")
    session_id: str = Field(description="Session that owns the snapshot")
    turn_index: int = Field(description="Turn index (starts at 0)")
    image: str = Field(description="Image data as base64 or object URL")
    format: str = Field(description='Image format, e.g. "png"')
    captured_at: str = Field(description="Capture time (ISO-8601)")


class Element(CamelModel):
    """A single element detected on the board (§6.4).

    bbox is optional: [x, y, w, h].
    """

    type: ElementType
    content: str
    bbox: list[float] | None = Field(
        default=None, description="Bounding box [x, y, w, h]"
    )


class VisionInterpretation(CamelModel):
    """Vision's output over a snapshot — the core input for the Learner (§6.4).

    When confidence is below threshold, needsConfirmation is true and Vision
    includes a suggestedClarification instead of guessing silently (invariant §3.4).
    """

    snapshot_id: str = Field(description="Source snapshot")
    transcribed_text: str = Field(description="Text read from the board")
    elements: list[Element] = Field(
        default_factory=list, description="Detected elements"
    )
    confidence: float = Field(description="Confidence level 0..1")
    needs_confirmation: bool = Field(
        description="true when confidence is below threshold"
    )
    suggested_clarification: str | None = Field(
        default=None, description="Clarifying question for the user"
    )
