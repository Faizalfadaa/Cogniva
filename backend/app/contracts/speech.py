"""SpeechTranscript — the teacher's transcribed speech for one turn.

(Architecture Document §6.5). It is a core input for the Learner and part of
the transcript the Evaluator reads. Produced by ASR. When confidence is low,
the transcript is shown so the user can correct it (§3.5).
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel


class SpeechTranscript(CamelModel):
    segment_id: str = Field(description="Unique speech-segment identifier")
    session_id: str = Field(description="Session that owns the segment")
    turn_index: int = Field(description="Related turn index")
    transcript: str = Field(description="Transcribed text of the teacher's speech")
    audio_ref: str | None = Field(
        default=None, description="Reference/URL to the audio clip if stored"
    )
    confidence: float = Field(description="ASR confidence level 0..1")
    language: str = Field(description='Language code, e.g. "en-US"')
    captured_at: str = Field(description="Recording time (ISO-8601)")
