"""
Cogniva voice service — a cloning TTS model behind a small HTTP API.

The Node backend never imports a Python model; it calls this service over HTTP
and degrades to silence when it is unavailable. That mirrors the rule the rest
of the app follows: a missing AI dependency must never break the flow.

    POST /synthesize   {text, voice, language?}  -> audio/wav
    GET  /voices                                 -> voices with a reference clip
    GET  /health                                 -> readiness, device, voices

Run it with:
    uvicorn app.main:app --host 0.0.0.0 --port 8020
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import config
from .synthesizer import SynthesizerNotReady, synthesizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("tts")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if config.WARM_ON_STARTUP:
        # Loaded off the event loop so uvicorn can already answer /health with
        # ready=false instead of appearing dead for the minute this takes.
        threading.Thread(target=synthesizer.load, name="tts-warmup", daemon=True).start()
    yield


app = FastAPI(title="Cogniva TTS", version="1.0.0", lifespan=lifespan)

# Only the backend calls this service, but allowing localhost keeps a browser
# able to hit /health directly while debugging.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1)
    # Matches a file in the voices directory; unknown names fall back to the
    # built-in speaker rather than failing.
    voice: str = "default"
    language: str | None = None


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok" if synthesizer.ready else "loading",
        "ready": synthesizer.ready,
        "engine": synthesizer.engine_name,
        "device": synthesizer.device,
        "language": config.DEFAULT_LANGUAGE,
        "voices": synthesizer.available_voices(),
        "error": synthesizer.load_error,
    }


@app.get("/voices")
def voices() -> dict:
    available = synthesizer.available_voices()
    return {
        "voices": available,
        "fallbackSpeaker": config.FALLBACK_SPEAKER,
        "voicesDir": str(config.VOICES_DIR),
    }


@app.post("/synthesize")
def synthesize(request: SynthesizeRequest) -> Response:
    try:
        audio, meta = synthesizer.synthesize(request.text, request.voice, request.language)
    except SynthesizerNotReady as err:
        # 503 tells the backend "try later", which it treats as "no audio this
        # time" rather than an error worth surfacing to the user.
        raise HTTPException(status_code=503, detail=str(err)) from err
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except Exception as err:  # noqa: BLE001
        log.exception("synthesis failed")
        raise HTTPException(status_code=500, detail=f"{type(err).__name__}: {err}") from err

    return Response(
        content=audio,
        media_type="audio/wav",
        headers={
            "X-TTS-Cached": "1" if meta["cached"] else "0",
            "X-TTS-Cloned": "1" if meta["cloned"] else "0",
            "X-TTS-Language": meta["language"],
            "Cache-Control": "no-store",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT)
