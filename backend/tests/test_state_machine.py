"""Uji mesin status sesi (Dokumen Arsitektur §4) — menegakkan invarian M0."""

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


def test_jalur_maju_penuh():
    s = SessionStatus.PERSIAPAN
    s = next_status(s, START)
    assert s == SessionStatus.MENGAJAR
    s = next_status(s, END)
    assert s == SessionStatus.SELESAI
    s = next_status(s, EVALUATE)
    assert s == SessionStatus.EVALUASI


def test_tidak_ada_jalur_mundur():
    # SELESAI tidak bisa kembali ke MENGAJAR (§4.2).
    assert not can_transition(SessionStatus.SELESAI, START)
    with pytest.raises(InvalidTransition):
        next_status(SessionStatus.SELESAI, START)


def test_evaluasi_terminal():
    for event in (START, END, EVALUATE):
        assert not can_transition(SessionStatus.EVALUASI, event)


def test_evaluate_hanya_dari_selesai():
    assert can_transition(SessionStatus.SELESAI, EVALUATE)
    assert not can_transition(SessionStatus.MENGAJAR, EVALUATE)
    assert not can_transition(SessionStatus.PERSIAPAN, EVALUATE)


def test_teaching_input_hanya_saat_mengajar():
    assert accepts_teaching_input(SessionStatus.MENGAJAR)
    assert not accepts_teaching_input(SessionStatus.PERSIAPAN)
    assert not accepts_teaching_input(SessionStatus.SELESAI)
    assert not accepts_teaching_input(SessionStatus.EVALUASI)
