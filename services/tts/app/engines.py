"""
The swappable model layer.

Everything above this file — the HTTP contract, the cache, text cleaning, the
per-voice settings — is engine-agnostic. Only the classes here know what a model
actually is, which is what makes changing model a contained decision rather than
a rewrite.

Two engines ship:

    chatterbox  Resemble AI's Chatterbox (MIT). Default. Better prosody on
                expressive character voices, and commercially usable.
    xtts        Coqui XTTS v2 (CPML, non-commercial). Kept so a disappointing
                switch can be undone with one environment variable.

Both take the same input — text, a reference clip, a settings dict — and return
WAV bytes.
"""

from __future__ import annotations

import io
import logging
import wave
from pathlib import Path
from typing import Protocol

from . import config

log = logging.getLogger("tts.engines")


class Engine(Protocol):
    """What the synthesizer needs from a model. Implement this to add one."""

    name: str

    def load(self) -> None:
        """Load weights. Called once; may take minutes."""

    @property
    def loaded(self) -> bool: ...

    @property
    def device(self) -> str: ...

    def render(
        self, text: str, language: str, reference: Path | None, settings: dict
    ) -> bytes:
        """Synthesize and return WAV bytes."""


# --- Chatterbox -------------------------------------------------------------


class ChatterboxEngine:
    """
    Resemble AI Chatterbox.

    Its two characteristic knobs have no XTTS equivalent:

      exaggeration  how far the delivery is pushed past the reference's own
                    energy. 0.5 is neutral; higher is more theatrical.
      cfg_weight    how tightly generation is steered. Lower loosens the pacing,
                    which the model card recommends for fast-talking references.

    Sampling settings that mean nothing here (top_k, speed, XTTS conditioning
    lengths) are dropped rather than forwarded, so a voices.json written for
    either engine stays valid for both.
    """

    name = "chatterbox"

    # Exactly what generate() takes — verified against the installed package,
    # not the docs. Anything else (top_k, speed) is dropped, not forwarded.
    ACCEPTS = frozenset(
        {"exaggeration", "cfg_weight", "temperature", "repetition_penalty", "min_p", "top_p"}
    )

    def __init__(self) -> None:
        self._model = None
        self._device = "cpu"

    @property
    def loaded(self) -> bool:
        return self._model is not None

    @property
    def device(self) -> str:
        return self._device

    def load(self) -> None:
        import torch
        from chatterbox.tts import ChatterboxTTS

        device = config.DEVICE
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"

        # Prefer weights fetched by fetch_model.py. from_pretrained() goes
        # through huggingface_hub, which stalls indefinitely here; from_local()
        # just reads the directory.
        local = config.MODELS_DIR / "chatterbox"
        required = ["ve.safetensors", "t3_cfg.safetensors", "s3gen.safetensors",
                    "tokenizer.json", "conds.pt"]
        if all((local / f).is_file() for f in required):
            log.info("loading chatterbox from %s on %s", local, device)
            self._model = ChatterboxTTS.from_local(local, device)
        else:
            missing = [f for f in required if not (local / f).is_file()]
            log.info("weights incomplete in %s (missing %s); trying the hub", local, missing)
            self._model = ChatterboxTTS.from_pretrained(device=device)
        self._device = device
        log.info("chatterbox ready on %s", device)

    def render(
        self, text: str, language: str, reference: Path | None, settings: dict
    ) -> bytes:
        kwargs = {k: v for k, v in settings.items() if k in self.ACCEPTS}
        if reference is not None:
            kwargs["audio_prompt_path"] = str(reference)
        # No reference clip means Chatterbox uses its own built-in voice; unlike
        # XTTS there is no named speaker to pick, so nothing else to pass.
        wav = self._model.generate(text, **kwargs)
        return _tensor_to_wav_bytes(wav, self._model.sr)


def _tensor_to_wav_bytes(wav, sample_rate: int) -> bytes:
    """
    Torch tensor -> 16-bit PCM WAV bytes.

    Written by hand rather than through torchaudio.save so the service never
    touches the filesystem for a render it may not even cache, and so the byte
    layout matches what XTTS produces — the HTTP contract promises audio/wav
    either way.
    """
    import torch

    audio = wav.detach().to("cpu").float()
    if audio.dim() == 1:
        audio = audio.unsqueeze(0)
    # Mixing to mono keeps both engines' output shape identical.
    if audio.shape[0] > 1:
        audio = audio.mean(dim=0, keepdim=True)

    # Clamp before quantising: values outside [-1, 1] would wrap and click.
    samples = (torch.clamp(audio, -1.0, 1.0) * 32767.0).to(torch.int16).numpy()

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(int(sample_rate))
        out.writeframes(samples.tobytes())
    return buffer.getvalue()


# --- XTTS v2 ----------------------------------------------------------------


class XttsEngine:
    """
    Coqui XTTS v2, kept as the fallback engine.

    Licensed under the Coqui Public Model License: non-commercial only. That is
    the main reason it is no longer the default.
    """

    name = "xtts"

    ACCEPTS = frozenset(
        {
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

    def __init__(self) -> None:
        self._model = None
        self._device = "cpu"

    @property
    def loaded(self) -> bool:
        return self._model is not None

    @property
    def device(self) -> str:
        return self._device

    def load(self) -> None:
        import os

        # Agreeing to the Coqui Public Model License non-interactively. Without
        # this the first model download blocks forever on a terminal prompt that
        # nobody is there to answer.
        os.environ.setdefault("COQUI_TOS_AGREED", "1")

        import torch

        try:
            from TTS.api import TTS
        except ImportError as err:
            # Installing Chatterbox pulls transformers 5.x; coqui-tts pins
            # <=4.46.2. The two cannot share one virtualenv, so say so plainly
            # instead of surfacing a bare "cannot import name LogitsWarper".
            raise RuntimeError(
                "the xtts engine cannot run in this environment: coqui-tts needs "
                "transformers<=4.46.2 but Chatterbox installed 5.x. Use a separate "
                f"virtualenv for XTTS, or keep TTS_ENGINE=chatterbox. ({err})"
            ) from err

        device = config.DEVICE
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"

        log.info("loading %s on %s", config.XTTS_MODEL_NAME, device)
        model = TTS(model_name=config.XTTS_MODEL_NAME, progress_bar=False)
        model.to(device)
        self._model = model
        self._device = device
        log.info("xtts ready on %s", device)

    def render(
        self, text: str, language: str, reference: Path | None, settings: dict
    ) -> bytes:
        import tempfile

        kwargs = {k: v for k, v in settings.items() if k in self.ACCEPTS}
        kwargs.update(text=text, language=language, split_sentences=True)
        if reference is not None:
            kwargs["speaker_wav"] = str(reference)
        else:
            kwargs["speaker"] = config.FALLBACK_SPEAKER

        # tts_to_file is the only path that handles every XTTS variant, so it
        # gets a scratch file that is read back and discarded.
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as scratch:
            path = Path(scratch.name)
        try:
            self._model.tts_to_file(file_path=str(path), **kwargs)
            return path.read_bytes()
        finally:
            path.unlink(missing_ok=True)


# --- factory ----------------------------------------------------------------

ENGINES = {"chatterbox": ChatterboxEngine, "xtts": XttsEngine}


def build_engine(name: str | None = None) -> Engine:
    key = (name or config.ENGINE).strip().lower()
    if key not in ENGINES:
        log.warning("unknown engine %r; falling back to chatterbox", key)
        key = "chatterbox"
    return ENGINES[key]()
