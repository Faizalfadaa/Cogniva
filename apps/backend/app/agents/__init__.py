"""AI agents (Architecture Document §3.4-§3.7).

M1 makes the Learner real (it calls a text LLM with a student persona). Vision
and ASR stay as passthrough stubs until M2 — the critical path (backend +
canvas + Learner) stands up first, then Vision/Evaluator stack on top (§12).
"""

from __future__ import annotations

from .learner import LearnerAgent, seed_learner_state
from .vision import VisionAgent

__all__ = ["LearnerAgent", "seed_learner_state", "VisionAgent"]
