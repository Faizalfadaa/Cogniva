"""TeachingTurn — a single record of one teaching turn (Architecture Document §6.6).

The sequence of these objects forms the transcript. Each turn combines the
board channel (snapshot + interpretation) and the voice channel (speech
transcript).
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .board import VisionInterpretation
from .speech import SpeechTranscript


class TeachingTurn(CamelModel):
    turn_index: int = Field(description="Turn index within the session")
    session_id: str = Field(description="Session that owns the turn")
    snapshot_id: str = Field(description="Board snapshot for this turn")
    interpretation: VisionInterpretation = Field(description="Board reading result")
    speech_transcript: SpeechTranscript | None = Field(
        default=None, description="Teacher's speech transcript for this turn"
    )
    typed_input: str | None = Field(
        default=None, description="Optional typed text (supplement/fallback)"
    )
    learner_response_id: str = Field(description="Reference to the Learner's response")
    created_at: str = Field(description="Turn time (ISO-8601)")
