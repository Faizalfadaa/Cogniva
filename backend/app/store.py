"""In-memory storage for the M1 skeleton.

The persistent storage model (SQLite + object store) comes in a later
milestone (Architecture Document §8). For M1 an in-memory store holds the
session, its teaching turns (the transcript), board snapshots, speech
transcripts, learner responses, and the per-session LearnerState — everything
one full teaching turn produces and the Evaluator (M3) will later read.

The topic repository is loaded from JSON seed files (1-2 demo topics, an M0
deliverable).
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from .contracts.board import BoardSnapshot
from .contracts.evaluation import EvaluationResult
from .contracts.learner import LearnerResponse, LearnerState
from .contracts.session import Session
from .contracts.speech import SpeechTranscript
from .contracts.teaching import TeachingTurn
from .contracts.topic import Topic

_SEED_DIR = Path(__file__).parent / "data" / "topics"


class TopicRepository:
    """Curated demo topics, loaded from JSON seed files up front (§6.1)."""

    def __init__(self) -> None:
        self._topics: dict[str, Topic] = {}
        self._load_seed()

    def _load_seed(self) -> None:
        if not _SEED_DIR.exists():
            return
        for path in sorted(_SEED_DIR.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            topic = Topic.model_validate(data)
            self._topics[topic.topic_id] = topic

    def list(self) -> list[Topic]:
        return list(self._topics.values())

    def get(self, topic_id: str) -> Topic | None:
        return self._topics.get(topic_id)


class SessionStore:
    """In-memory store for sessions and everything a turn produces (§8 placeholder)."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._evaluations: dict[str, EvaluationResult] = {}
        self._snapshots: dict[str, BoardSnapshot] = {}
        self._transcripts: dict[str, SpeechTranscript] = {}
        self._responses: dict[str, LearnerResponse] = {}
        self._learner_states: dict[str, LearnerState] = {}
        self._turns: dict[str, list[TeachingTurn]] = {}

    @staticmethod
    def new_id(prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    # --- Session ----------------------------------------------------------

    def save_session(self, session: Session) -> Session:
        self._sessions[session.session_id] = session
        return session

    def get_session(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    # --- Evaluation -------------------------------------------------------

    def save_evaluation(self, result: EvaluationResult) -> EvaluationResult:
        self._evaluations[result.session_id] = result
        return result

    def get_evaluation_by_session(self, session_id: str) -> EvaluationResult | None:
        return self._evaluations.get(session_id)

    # --- Board snapshots --------------------------------------------------

    def save_snapshot(self, snapshot: BoardSnapshot) -> BoardSnapshot:
        self._snapshots[snapshot.snapshot_id] = snapshot
        return snapshot

    def get_snapshot(self, snapshot_id: str) -> BoardSnapshot | None:
        return self._snapshots.get(snapshot_id)

    # --- Speech transcripts ----------------------------------------------

    def save_transcript(self, transcript: SpeechTranscript) -> SpeechTranscript:
        self._transcripts[transcript.segment_id] = transcript
        return transcript

    # --- Learner responses & state ---------------------------------------

    def save_response(self, response: LearnerResponse) -> LearnerResponse:
        self._responses[response.response_id] = response
        return response

    def get_response(self, response_id: str) -> LearnerResponse | None:
        return self._responses.get(response_id)

    def save_learner_state(self, state: LearnerState) -> LearnerState:
        self._learner_states[state.session_id] = state
        return state

    def get_learner_state(self, session_id: str) -> LearnerState | None:
        return self._learner_states.get(session_id)

    # --- Teaching turns (the transcript) ----------------------------------

    def save_turn(self, turn: TeachingTurn) -> TeachingTurn:
        self._turns.setdefault(turn.session_id, []).append(turn)
        return turn

    def list_turns(self, session_id: str) -> list[TeachingTurn]:
        return list(self._turns.get(session_id, []))


# Singleton stores for the skeleton
topics = TopicRepository()
sessions = SessionStore()
