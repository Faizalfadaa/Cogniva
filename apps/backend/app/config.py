"""Runtime configuration (read from environment).

Centralizes the knobs the orchestrator and agents need. Nothing here is a
secret by itself — the Gemini API key is read by the SDK from the
environment, we only check for its presence to decide whether the real LLM
path is available or we should fall back to a deterministic Learner.
"""

from __future__ import annotations

import os

# --- LLM wrapper (Architecture Document §3.3, §7.3) ------------------------

# Default to a fast Gemini model suited to the real-time teaching loop. Teams
# may set COGNIVA_LEARNER_MODEL=gemini-2.5-pro for higher-quality responses.
LEARNER_MODEL: str = os.getenv("COGNIVA_LEARNER_MODEL", "gemini-2.5-flash")
LLM_MAX_TOKENS: int = int(os.getenv("COGNIVA_LLM_MAX_TOKENS", "2048"))
LLM_TIMEOUT: float = float(os.getenv("COGNIVA_LLM_TIMEOUT", "60"))

# --- Vision (§3.4) ---------------------------------------------------------

# Below this confidence the orchestrator asks the user to confirm/correct the
# board reading instead of guessing (real Vision lands in M2).
VISION_CONFIDENCE_THRESHOLD: float = float(
    os.getenv("COGNIVA_VISION_CONFIDENCE_THRESHOLD", "0.6")
)


def llm_available() -> bool:
    """True when a Gemini credential is configured in the environment."""
    return bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
