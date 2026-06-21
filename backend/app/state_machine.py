"""Session state machine (Architecture Document §4).

The orchestrator is the only party allowed to move the status, and every
transition is triggered by a clear event.

    SETUP --(start)--> TEACHING --(end)--> ENDED --(evaluate)--> EVALUATED

Rules (§4.2):
- Transitions are forward-only; there is no path back.
- teaching_input is only valid in the TEACHING state.
- Triggering evaluation is only valid in the ENDED state, and is idempotent.
- EVALUATED is terminal.
"""

from __future__ import annotations

from .contracts.enums import SessionStatus

# Events that trigger transitions
START = "start"
END = "end"
EVALUATE = "evaluate"

# Allowed transitions: (current_status, event) -> next_status
_TRANSITIONS: dict[tuple[SessionStatus, str], SessionStatus] = {
    (SessionStatus.SETUP, START): SessionStatus.TEACHING,
    (SessionStatus.TEACHING, END): SessionStatus.ENDED,
    (SessionStatus.ENDED, EVALUATE): SessionStatus.EVALUATED,
}


class InvalidTransition(Exception):
    """A status transition that is not allowed by the state machine."""

    def __init__(self, current: SessionStatus, event: str) -> None:
        self.current = current
        self.event = event
        super().__init__(
            f"Invalid transition: event '{event}' in status '{current}'"
        )


def next_status(current: SessionStatus, event: str) -> SessionStatus:
    """Return the next status for (status, event), or raise InvalidTransition."""
    try:
        return _TRANSITIONS[(SessionStatus(current), event)]
    except KeyError as exc:
        raise InvalidTransition(SessionStatus(current), event) from exc


def can_transition(current: SessionStatus, event: str) -> bool:
    """True if (status, event) is an allowed transition."""
    return (SessionStatus(current), event) in _TRANSITIONS


def accepts_teaching_input(current: SessionStatus) -> bool:
    """teaching_input is only valid in the TEACHING state (§4.2)."""
    return SessionStatus(current) == SessionStatus.TEACHING
