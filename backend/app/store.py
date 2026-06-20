"""Penyimpanan in-memory untuk M0/skeleton.

Model penyimpanan persisten (SQLite + objek) menyusul di milestone berikutnya
(Dokumen Arsitektur §8). Untuk M0 cukup store memori agar mesin status dan
kontrak dapat dijalankan & diuji ujung-ke-ujung tanpa logika agen.

Repositori topik dimuat dari berkas seed JSON (1-2 topik demo, deliverable M0).
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
    """Topik demo terkurasi, dimuat dari berkas seed JSON di muka (§6.1)."""

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
    """Store sesi + hasil evaluasi in-memory (placeholder M0 untuk §8)."""

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


# Singleton store untuk skeleton M0
topics = TopicRepository()
sessions = SessionStore()
