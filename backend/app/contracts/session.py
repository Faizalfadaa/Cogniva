"""Session — the central object for one teaching session and its state (§6.2)."""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel
from .enums import SessionStatus


class Session(CamelModel):
    session_id: str = Field(description="Unique session identifier")
    topic_id: str = Field(description="Reference to the Topic being taught")
    status: SessionStatus = Field(
        description="SETUP | TEACHING | ENDED | EVALUATED"
    )
    created_at: str = Field(description="Session creation time (ISO-8601)")
    started_at: str | None = Field(default=None, description="Time teaching started")
    ended_at: str | None = Field(default=None, description="Time the session ended")
    turn_count: int = Field(
        default=0, description="Number of teaching turns taken so far"
    )
    evaluation_id: str | None = Field(
        default=None, description="Reference to the EvaluationResult once it exists"
    )
