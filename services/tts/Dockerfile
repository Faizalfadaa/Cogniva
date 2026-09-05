# syntax=docker/dockerfile:1
#
# Cogniva voice service — XTTS v2 behind FastAPI.
#
# CPU image. XTTS on CPU takes ~10-30s per reply, which is fine for a demo but
# not for a live session; for real use, run this on a GPU host with the CUDA
# torch wheel and the nvidia container runtime.
#
# Python is pinned to 3.11 because coqui-tts does not support 3.13.

FROM python:3.11-slim

# Model download and audio I/O need these; ffmpeg is used by the audio stack.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Accept the Coqui Public Model License non-interactively, otherwise the first
# model download blocks forever on a prompt. XTTS v2 is NON-COMMERCIAL ONLY.
ENV COQUI_TOS_AGREED=1 \
    PYTHONUNBUFFERED=1 \
    TTS_HOST=0.0.0.0 \
    TTS_PORT=8020

# Dependencies first so this layer caches until requirements change.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Reference recordings are mounted at runtime, never baked into the image —
# they are personal data. See docker-compose.yml.
VOLUME ["/app/voices", "/app/.cache"]

EXPOSE 8020

# Generous start period: the model has to download and load before it is ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8020/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8020"]
