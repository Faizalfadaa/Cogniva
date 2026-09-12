"""
Runtime configuration for the voice service.

Mirrors the backend's convention (apps/backend/src/config/index.ts): every knob
is read here and nowhere else, so a feature module never touches os.environ.
"""

import os
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parent.parent


def _str(name: str, fallback: str) -> str:
    return os.environ.get(name, "").strip() or fallback


def _int(name: str, fallback: int) -> int:
    try:
        return int(os.environ.get(name, ""))
    except ValueError:
        return fallback


def _bool(name: str, fallback: bool) -> bool:
    value = os.environ.get(name, "").strip().lower()
    if value in {"1", "true", "yes"}:
        return True
    if value in {"0", "false", "no"}:
        return False
    return fallback


# --- Model ------------------------------------------------------------------

# Which engine renders speech. See app/engines.py.
#
#   chatterbox  Resemble AI Chatterbox (MIT). Default: better prosody on
#               expressive character voices, and usable commercially.
#   xtts        Coqui XTTS v2 (CPML, non-commercial). Kept so the switch is
#               reversible with one variable.
ENGINE = _str("TTS_ENGINE", "chatterbox")

XTTS_MODEL_NAME = _str("TTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")

# Weights we fetch ourselves, outside any library cache. huggingface_hub stalls
# on this machine — open connection, zero bytes — while plain HTTP runs at
# ~3.5 MB/s, so fetch_model.py downloads here and the engine loads from here.
MODELS_DIR = Path(_str("TTS_MODELS_DIR", str(SERVICE_ROOT / "models")))

# "cuda", "cpu", or "auto" to pick CUDA when torch reports it available.
DEVICE = _str("TTS_DEVICE", "auto")

# Warm the model during startup so the service only reports healthy once it can
# actually answer. Set false for a fast boot that loads on the first request.
WARM_ON_STARTUP = _bool("TTS_WARM_ON_STARTUP", True)


# --- Voices -----------------------------------------------------------------

# Reference clips for cloning: <VOICES_DIR>/<voice>.wav
VOICES_DIR = Path(_str("TTS_VOICES_DIR", str(SERVICE_ROOT / "voices")))

# Used when the requested voice has no reference clip on disk. XTTS ships with
# built-in speakers, so a missing clip still speaks rather than failing.
FALLBACK_SPEAKER = _str("TTS_FALLBACK_SPEAKER", "Ana Florence")


# --- Language ---------------------------------------------------------------

# The 17 languages XTTS v2 was trained on. Indonesian is deliberately absent
# from this list because the model does not speak it; the app's Learner answers
# in English (see llm/prompts/learner.prompt.ts), so English is the right
# default and no substitution is needed today.
SUPPORTED_LANGUAGES = (
    "en", "es", "fr", "de", "it", "pt", "pl", "tr",
    "ru", "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko", "hi",
)

DEFAULT_LANGUAGE = _str("TTS_DEFAULT_LANGUAGE", "en")


def resolve_language(requested: str | None) -> str:
    """
    Map a requested language onto one XTTS actually speaks.

    An unsupported code falls back to the default rather than raising, so a
    caller asking for a language the model lacks still gets audio. If Indonesian
    output is ever needed, set TTS_DEFAULT_LANGUAGE=es: Indonesian and Spanish
    share five pure vowels, so a Spanish frontend reads Indonesian spelling far
    more faithfully than an English one, which forces it through English phonics.
    """
    code = (requested or DEFAULT_LANGUAGE).strip().lower()
    if code in SUPPORTED_LANGUAGES:
        return code
    return DEFAULT_LANGUAGE if DEFAULT_LANGUAGE in SUPPORTED_LANGUAGES else "en"


# --- Inference tuning -------------------------------------------------------

# Per-voice overrides live here so tuning never needs a code change or a
# restart: edit the file, send the next request. See tune.py.
VOICE_SETTINGS_FILE = Path(
    _str("TTS_VOICE_SETTINGS_FILE", str(VOICES_DIR / "voices.json"))
)

# Only these reach the model. XTTS silently forwards unknown keyword arguments
# into the HF generate call, where a typo becomes a confusing crash rather than
# an ignored setting.
ALLOWED_INFERENCE_KEYS = frozenset(
    {
        "exaggeration",
        "cfg_weight",
        "min_p",
        "temperature",
        "top_p",
        "top_k",
        "repetition_penalty",
        "length_penalty",
        "speed",
        "sound_norm_refs",
        "gpt_cond_len",
        "gpt_cond_chunk_len",
        "max_ref_len",
    }
)

def _float(name: str, fallback: float) -> float:
    try:
        return float(os.environ.get(name, ""))
    except ValueError:
        return fallback


# Baseline settings per engine, applied to every voice unless overridden.
#
# These MUST be separate: the same key means different things to each model.
# `repetition_penalty` defaults to 1.2 in Chatterbox and 5.0 in XTTS, so a single
# shared value would badly mangle one of them. Each block starts from its own
# model's documented defaults, adjusted only where we have a reason.
DEFAULT_INFERENCE: dict[str, dict[str, float | int | bool]] = {
    "chatterbox": {
        # Chatterbox's own defaults. exaggeration is delivery intensity (0.5
        # neutral); cfg_weight steers how tightly generation follows — the model
        # card suggests lowering it for fast-talking references.
        "exaggeration": _float("TTS_EXAGGERATION", 0.5),
        "cfg_weight": _float("TTS_CFG_WEIGHT", 0.5),
        "temperature": _float("TTS_TEMPERATURE", 0.8),
        "repetition_penalty": _float("TTS_REPETITION_PENALTY", 1.2),
        "min_p": _float("TTS_MIN_P", 0.05),
        "top_p": _float("TTS_TOP_P", 1.0),
    },
    "xtts": {
        # XTTS ships 0.75/0.85, tuned for expressiveness. Slightly tightened
        # here because it reproduces a mumbled reference all too faithfully.
        "temperature": 0.70,
        "top_p": 0.85,
        "top_k": 50,
        "repetition_penalty": 5.0,
        "length_penalty": 1.0,
        "speed": 1.0,
        "sound_norm_refs": True,
    },
}


def baseline_for(engine: str) -> dict:
    """Starting settings for an engine; empty for one we know nothing about."""
    return dict(DEFAULT_INFERENCE.get(engine, {}))


# --- Synthesis limits -------------------------------------------------------

# Upper bound on one request's text. Latency grows with length, and the caller
# is always a short chat reply or learner reaction, never a document.
MAX_TEXT_CHARS = _int("TTS_MAX_TEXT_CHARS", 800)


# --- Cache ------------------------------------------------------------------

# Rendered clips keyed by text+voice+language, so a repeated line is instant.
CACHE_DIR = Path(_str("TTS_CACHE_DIR", str(SERVICE_ROOT / ".cache")))
CACHE_ENABLED = _bool("TTS_CACHE_ENABLED", True)
CACHE_MAX_ENTRIES = _int("TTS_CACHE_MAX_ENTRIES", 500)


# --- Server -----------------------------------------------------------------

HOST = _str("TTS_HOST", "0.0.0.0")
PORT = _int("TTS_PORT", 8020)
