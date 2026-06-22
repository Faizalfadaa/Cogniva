"""Centralized LLM-call wrapper (Architecture Document §3.3, §7.3)."""

from __future__ import annotations

from .client import LLMClient, LLMError

__all__ = ["LLMClient", "LLMError"]
