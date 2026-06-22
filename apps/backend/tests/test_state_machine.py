"""Session state-machine tests (Architecture Document §4) — enforce M0 invariants."""

import pytest

from app.contracts.enums import SessionStatus
from app.state_machine import (
    END,
    EVALUATE,
    START,
    InvalidTransition,
    accepts_teaching_input,
    can_transition,
    next_status,
)


def test_full_forward_path():
    s = SessionStatus.SETUP
    s = next_status(s, START)
    assert s == SessionStatus.TEACHING
    s = next_status(s, END)
    assert s == SessionStatus.ENDED
    s = next_status(s, EVALUATE)
    assert s == SessionStatus.EVALUATED


def test_no_backward_path():
    # ENDED cannot go back to TEACHING (§4.2).
    assert not can_transition(SessionStatus.ENDED, START)
    with pytest.raises(InvalidTransition):
        next_status(SessionStatus.ENDED, START)


def test_evaluated_is_terminal():
    for event in (START, END, EVALUATE):
        assert not can_transition(SessionStatus.EVALUATED, event)


def test_evaluate_only_from_ended():
    assert can_transition(SessionStatus.ENDED, EVALUATE)
    assert not can_transition(SessionStatus.TEACHING, EVALUATE)
    assert not can_transition(SessionStatus.SETUP, EVALUATE)


def test_teaching_input_only_while_teaching():
    assert accepts_teaching_input(SessionStatus.TEACHING)
    assert not accepts_teaching_input(SessionStatus.SETUP)
    assert not accepts_teaching_input(SessionStatus.ENDED)
    assert not accepts_teaching_input(SessionStatus.EVALUATED)
