"""
Synthesis orchestration — everything around the model, but not the model itself.

This layer owns text cleaning, the per-voice settings, the render cache, and the
single-flight lock. Which model actually speaks is decided in engines.py, so
changing engine touches one file and leaves the HTTP contract, the cache and the
tuning workflow exactly as they were.

The model is loaded once and reused; loading costs minutes and gigabytes of
VRAM, so it must never happen per request. Rendering is serialised behind a lock
because these models keep mutable state and are not safe to call concurrently,
and a single GPU would serialise the work anyway.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
from pathlib import Path

from . import config
from .engines import Engine, build_engine

log = logging.getLogger("tts.synthesizer")


class SynthesizerNotReady(RuntimeError):
    """Raised while the model is still loading."""


class Synthesizer:
    def __init__(self) -> None:
        self._engine: Engine = build_engine()
        self._lock = threading.Lock()
        self._load_lock = threading.Lock()
        self._load_error: str | None = None

    # --- lifecycle ---------------------------------------------------------

    @property
    def ready(self) -> bool:
        return self._engine.loaded

    @property
    def device(self) -> str:
        return self._engine.device

    @property
    def engine_name(self) -> str:
        return self._engine.name

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def load(self) -> None:
        """Load the model. Safe to call repeatedly; only the first call works."""
        if self._engine.loaded:
            return
        with self._load_lock:
            if self._engine.loaded:
                return
            try:
                self._engine.load()
                self._load_error = None
            except Exception as err:  # noqa: BLE001 - surfaced through /health
                self._load_error = f"{type(err).__name__}: {err}"
                log.exception("engine %s failed to load", self._engine.name)

    # --- voices ------------------------------------------------------------

    def available_voices(self) -> list[str]:
        """Voice ids that have a reference clip on disk, sorted."""
        if not config.VOICES_DIR.is_dir():
            return []
        return sorted(
            path.stem
            for path in config.VOICES_DIR.iterdir()
            if path.is_file() and path.suffix.lower() in {".wav", ".mp3", ".flac", ".ogg"}
        )

    def reference_clip(self, voice: str) -> Path | None:
        """The reference clip for `voice`, or None to use the built-in voice."""
        safe = re.sub(r"[^a-z0-9_-]", "", voice.lower())
        if not safe:
            return None
        for suffix in (".wav", ".mp3", ".flac", ".ogg"):
            candidate = config.VOICES_DIR / f"{safe}{suffix}"
            if candidate.is_file():
                return candidate
        return None

    # --- inference settings ------------------------------------------------

    def settings_for(self, voice: str) -> dict:
        """
        Decoding settings for one voice: this engine's baseline, then any
        per-voice override from voices.json.

        An entry in that file may be nested by engine — the useful form, since
        a value tuned for one model rarely transfers to another:

            "akira": { "chatterbox": {...}, "xtts": {...} }

        or flat, which applies to whichever engine is running:

            "akira": { "exaggeration": 0.4 }

        Read on every call rather than cached, because the file is tiny and
        tuning by ear means editing it and immediately re-rendering. A broken
        file degrades to the baseline instead of taking the service down.
        """
        engine = self._engine.name
        settings = config.baseline_for(engine)

        entry = self._voice_overrides().get(voice, {})
        nested = {name: block for name, block in entry.items() if name in config.DEFAULT_INFERENCE}
        overrides = nested.get(engine, {}) if nested else entry

        for key, value in overrides.items():
            if key.startswith("_"):
                continue  # commentary in the JSON, not a setting
            if key in config.ALLOWED_INFERENCE_KEYS:
                settings[key] = value
            else:
                log.warning("ignoring unknown setting %r for voice %r", key, voice)
        return settings

    def _voice_overrides(self) -> dict:
        path = config.VOICE_SETTINGS_FILE
        if not path.is_file():
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as err:
            log.warning("could not read %s (%s); using baseline settings", path, err)
            return {}
        if not isinstance(data, dict):
            log.warning("%s should be an object keyed by voice id", path)
            return {}
        return {k: v for k, v in data.items() if isinstance(v, dict)}

    # --- synthesis ---------------------------------------------------------

    def synthesize(self, text: str, voice: str, language: str | None) -> tuple[bytes, dict]:
        """
        Render `text` in `voice` and return (wav_bytes, metadata).

        Raises SynthesizerNotReady while the model is still loading.
        """
        if not self._engine.loaded:
            raise SynthesizerNotReady(self._load_error or "model is still loading")

        clean = clean_text(text)
        if not clean:
            raise ValueError("text is empty after cleaning")

        lang = config.resolve_language(language)
        clip = self.reference_clip(voice)
        settings = self.settings_for(voice)
        cache_path = self._cache_path(clean, voice, lang, clip, settings)

        meta = {
            "language": lang,
            "cloned": clip is not None,
            "voice": voice,
            "engine": self._engine.name,
            "settings": settings,
        }

        if cache_path and cache_path.is_file():
            return cache_path.read_bytes(), {**meta, "cached": True}

        with self._lock:
            audio = self._engine.render(clean, lang, clip, settings)

        if cache_path:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(audio)
            self._prune_cache()

        return audio, {**meta, "cached": False}

    # --- cache -------------------------------------------------------------

    def _cache_path(
        self, text: str, voice: str, language: str, clip: Path | None, settings: dict
    ) -> Path | None:
        if not config.CACHE_ENABLED:
            return None
        # The clip's mtime is part of the key so replacing a reference recording
        # invalidates everything previously rendered in that voice. The engine
        # and the tuning are in there too, so switching model or adjusting a
        # setting never returns a clip made under the old ones — which would
        # make comparing by ear silently useless.
        stamp = str(clip.stat().st_mtime_ns) if clip else "builtin"
        tuning = json.dumps(settings, sort_keys=True)
        digest = hashlib.sha256(
            "\x1f".join([self._engine.name, text, voice, language, stamp, tuning]).encode("utf-8")
        ).hexdigest()[:32]
        return config.CACHE_DIR / f"{digest}.wav"

    def _prune_cache(self) -> None:
        """Keep the newest CACHE_MAX_ENTRIES files; drop the rest."""
        try:
            files = sorted(
                config.CACHE_DIR.glob("*.wav"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            for stale in files[config.CACHE_MAX_ENTRIES:]:
                stale.unlink(missing_ok=True)
        except OSError:
            log.warning("cache prune failed", exc_info=True)


def clean_text(text: str) -> str:
    """
    Strip what should never be read aloud and bound the length.

    Learner replies are plain prose, but they do pick up the occasional emoji or
    markdown emphasis, and the models spell those out instead of ignoring them.
    """
    cleaned = re.sub(r"[*_`#~]+", " ", text or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) > config.MAX_TEXT_CHARS:
        # Cut on a sentence boundary when one is near the limit, so the audio
        # ends on a finished thought rather than mid-word.
        window = cleaned[: config.MAX_TEXT_CHARS]
        cut = max(window.rfind(". "), window.rfind("! "), window.rfind("? "))
        cleaned = window[: cut + 1] if cut > config.MAX_TEXT_CHARS // 2 else window
    return cleaned


synthesizer = Synthesizer()
