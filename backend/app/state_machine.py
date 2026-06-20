"""Mesin status sesi (Dokumen Arsitektur §4).

Orchestrator adalah satu-satunya pihak yang boleh memindahkan status, dan
setiap transisi dipicu oleh peristiwa yang jelas.

    PERSIAPAN --(start)--> MENGAJAR --(end)--> SELESAI --(evaluate)--> EVALUASI

Aturan (§4.2):
- Transisi hanya boleh maju; tidak ada jalur mundur.
- Pesan teaching_input hanya sah diproses pada status MENGAJAR.
- Pemicuan evaluasi hanya sah pada status SELESAI, dan idempoten.
- EVALUASI bersifat terminal.
"""

from __future__ import annotations

from .contracts.enums import SessionStatus

# Peristiwa yang memicu transisi
START = "start"
END = "end"
EVALUATE = "evaluate"

# Transisi yang diperbolehkan: (status_sekarang, peristiwa) -> status_berikut
_TRANSITIONS: dict[tuple[SessionStatus, str], SessionStatus] = {
    (SessionStatus.PERSIAPAN, START): SessionStatus.MENGAJAR,
    (SessionStatus.MENGAJAR, END): SessionStatus.SELESAI,
    (SessionStatus.SELESAI, EVALUATE): SessionStatus.EVALUASI,
}


class InvalidTransition(Exception):
    """Transisi status yang tidak sah menurut mesin status."""

    def __init__(self, current: SessionStatus, event: str) -> None:
        self.current = current
        self.event = event
        super().__init__(
            f"Transisi tidak sah: peristiwa '{event}' pada status '{current}'"
        )


def next_status(current: SessionStatus, event: str) -> SessionStatus:
    """Kembalikan status berikut untuk (status, peristiwa) atau lempar error."""
    try:
        return _TRANSITIONS[(SessionStatus(current), event)]
    except KeyError as exc:
        raise InvalidTransition(SessionStatus(current), event) from exc


def can_transition(current: SessionStatus, event: str) -> bool:
    """True bila (status, peristiwa) merupakan transisi yang sah."""
    return (SessionStatus(current), event) in _TRANSITIONS


def accepts_teaching_input(current: SessionStatus) -> bool:
    """teaching_input hanya sah pada status MENGAJAR (§4.2)."""
    return SessionStatus(current) == SessionStatus.MENGAJAR
