"""WebSocket message contracts (Architecture Document §7.2).

The real-time session channel uses WebSocket at /ws/sessions/{id}. Every
message carries a `type` field. Client-to-server messages are only processed
when the session status allows it (e.g. teaching_input only in TEACHING).
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from ..contracts.base import CamelModel
from ..contracts.board import VisionInterpretation
from ..contracts.learner import LearnerResponse
from ..contracts.speech import SpeechTranscript

# --- Client -> Server ------------------------------------------------------


class TeachingInput(CamelModel):
    """{ image, audio?, typedText? } — submit a turn (while TEACHING)."""

    type: Literal["teaching_input"] = "teaching_input"
    image: str = Field(description="Board snapshot: base64 or URL")
    audio: str | None = Field(default=None, description="Teacher's voice clip")
    typed_text: str | None = Field(default=None, description="Optional typed text")


class ConfirmationResponse(CamelModel):
    """{ snapshotId, corrected } — correct an uncertain interpretation."""

    type: Literal["confirmation_response"] = "confirmation_response"
    snapshot_id: str
    corrected: str = Field(description="Interpretation text corrected by the user")


class EndSession(CamelModel):
    """Request to end the session."""

    type: Literal["end_session"] = "end_session"


# --- Server -> Client ------------------------------------------------------


class VisionResult(CamelModel):
    """{ interpretation } — board reading result."""

    type: Literal["vision_result"] = "vision_result"
    interpretation: VisionInterpretation


class SpeechResult(CamelModel):
    """{ transcript } — teacher's speech transcript."""

    type: Literal["speech_result"] = "speech_result"
    transcript: SpeechTranscript


class ConfirmationRequest(CamelModel):
    """{ snapshotId, suggestedClarification } — request confirmation."""

    type: Literal["confirmation_request"] = "confirmation_request"
    snapshot_id: str
    suggested_clarification: str


class LearnerMessage(CamelModel):
    """{ response } — the student's utterance (streamed)."""

    type: Literal["learner_message"] = "learner_message"
    response: LearnerResponse


class StateUpdate(CamelModel):
    """{ status } — a session status change."""

    type: Literal["state_update"] = "state_update"
    status: str


class ErrorMessage(CamelModel):
    """{ message } — a recoverable error."""

    type: Literal["error"] = "error"
    message: str
