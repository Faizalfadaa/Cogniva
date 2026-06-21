"""In-memory storage for the M0 skeleton.

The persistent storage model (SQLite + object store) comes in a later
milestone (Architecture Document §8). For M0 an in-memory store is enough so
the state machine and contracts can run and be tested end-to-end without any
agent logic.

The topic repository is loaded from JSON seed files (1-2 demo topics, an M0
deliverable).
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from .contracts.evaluation import EvaluationResult
from .contracts.session import Session
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
    """In-memory session + evaluation store (M0 placeholder for §8)."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._evaluations: dict[str, EvaluationResult] = {}

    @staticmethod
    def new_id(prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    def save_session(self, session: Session) -> Session:
        self._sessions[session.session_id] = session
        return session

    def get_session(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def save_evaluation(self, result: EvaluationResult) -> EvaluationResult:
        self._evaluations[result.session_id] = result
        return result

    def get_evaluation_by_session(self, session_id: str) -> EvaluationResult | None:
        return self._evaluations.get(session_id)


# Singleton stores for the M0 skeleton
topics = TopicRepository()
sessions = SessionStore()
