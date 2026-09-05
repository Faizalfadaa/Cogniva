# Cogniva voice service

Gives the AI learner a spoken voice, cloned from a short reference recording.

This is a **separate Python process**. These are PyTorch models with no usable
Node binding, so the backend calls it over HTTP and falls back to silence when it
is not running. Nothing in the app breaks when this service is off.

Two engines, chosen with `TTS_ENGINE`:

| | Licence | Notes |
|---|---|---|
| **`chatterbox`** (default) | MIT | Resemble AI. Better prosody on expressive character voices, and usable commercially. |
| `xtts` | CPML, **non-commercial** | Coqui XTTS v2. Needs its own virtualenv — see requirements.txt. |

```
Node backend  ──POST /synthesize──>  this service  ──> Chatterbox ──> audio/wav
     │                                                                   │
     └──────────── stores the clip, hands the UI a URL ───────────────────┘
```

---

## Before you start: two things that will bite you

**1. Python 3.13 does not work.** Neither engine builds on it, and a
fresh Windows install often has just 3.13. Check with `python --version`. If it
says 3.13, install 3.11 or 3.12 alongside it — you do not need to uninstall
anything:

```powershell
winget install Python.Python.3.11
```

Then use that interpreter explicitly when creating the virtualenv (below).

**2. Fetch the weights with `fetch_model.py`, not the library.** `huggingface_hub`
stalls on some networks — connection open, zero bytes transferred — and its Xet
transfer restarts a partial file from zero instead of resuming it. Both were
observed here. `fetch_model.py` downloads over plain HTTP with real resume, and
the engine then loads from `models/` without touching the hub at all.

---

## Setup

```bash
cd services/tts

# Use the 3.11/3.12 interpreter, not whatever `python` points at
py -3.11 -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

# NVIDIA GPU: install the CUDA build of torch FIRST, or pip will pull the
# CPU-only wheel and you will wonder why generation takes 30 seconds.
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124

pip install -r requirements.txt

# Download the model weights (~3.2 GB, resumable — safe to re-run)
.venv\Scripts\python.exe fetch_model.py
```

`fetch_model.py` writes the five Chatterbox files into `models/chatterbox/`
(~3.2 GB, once). It resumes a partial download and retries with backoff, so it
is safe to interrupt and re-run. A `.part` file is promoted to the real filename
only after the full declared length has arrived — an interrupted run can never
leave a truncated file that looks complete.

## Add the voices

Drop one recording per character into `voices/`:

```
voices/yuzuki.wav
voices/reina.wav
voices/akira.wav
```

6–30 seconds each, clean and close-mic'd. See [`voices/README.md`](voices/README.md)
for what makes a good clip and how to convert one with ffmpeg. **Only clone a
voice you have permission to clone.**

Missing files are not an error: that character falls back to the engine's own
built-in voice, so you can run the service before recording anything.

## Run it

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8020
```

Startup loads the model in a background thread — roughly 20–60 seconds — and
`/health` reports `ready: false` until it is done. Requests during that window
get a `503`, which the backend treats as "no audio this time".

```bash
curl http://localhost:8020/health
```

```json
{
  "status": "ok",
  "ready": true,
  "device": "cuda",
  "voices": ["akira", "reina", "yuzuki"]
}
```

## Turn it on in the backend

Speech is **off by default**. In `apps/backend/.env`:

```env
COGNIVA_TTS_ENABLED=true
COGNIVA_TTS_URL=http://localhost:8020
```

Restart the backend. Teach something, and the learner's reply arrives with audio
that plays automatically; the speaker button in the workspace header mutes it.

---

## API

### `POST /synthesize`

```json
{ "text": "Wait, so the oxygen comes from the water?", "voice": "yuzuki" }
```

Returns `audio/wav`. Useful response headers:

| Header | Meaning |
|---|---|
| `X-TTS-Cloned` | `1` if your reference clip was used, `0` for the built-in speaker |
| `X-TTS-Cached` | `1` if the clip was served from cache |
| `X-TTS-Language` | The language actually used |

### `GET /voices` · `GET /health`

Which voices have reference clips, and whether the model is loaded.

---

## Configuration

Every knob is read in `app/config.py` and nowhere else.

| Variable | Default | Notes |
|---|---|---|
| `TTS_DEVICE` | `auto` | `cuda`, `cpu`, or `auto` |
| `TTS_DEFAULT_LANGUAGE` | `en` | The learner answers in English |
| `TTS_VOICES_DIR` | `./voices` | Where reference clips live |
| `TTS_ENGINE` | `chatterbox` | `chatterbox` or `xtts` |
| `TTS_MODELS_DIR` | `./models` | Where fetch_model.py puts the weights |
| `TTS_EXAGGERATION` | `0.5` | Chatterbox: delivery intensity |
| `TTS_CFG_WEIGHT` | `0.5` | Chatterbox: lower loosens pacing |
| `TTS_MAX_TEXT_CHARS` | `800` | Longer input is cut at a sentence end |
| `TTS_CACHE_MAX_ENTRIES` | `500` | Rendered clips kept on disk |
| `TTS_WARM_ON_STARTUP` | `true` | Set false for a fast boot, slow first request |
| `TTS_PORT` | `8020` | |

### Fixing unclear pronunciation

These models clone **articulation, not just timbre**. A reference clip that is
fast or mumbled produces speech that is fast or mumbled — faithfully. That is the
usual cause when one character comes out less intelligible than another, and it
is not a defect in the recording.

The lever is the decoder, and the knobs differ by engine. On Chatterbox, lowering
`cfg_weight` loosens the pacing (the model card recommends it for fast-talking
references) and `exaggeration` sets delivery intensity. On XTTS, lowering
`temperature`/`top_p` picks better-articulated tokens and `speed` below 1.0 gives
each phoneme more room. All of them cost expressiveness, so the right point
depends on the voice — and can only be chosen by ear.

Per-voice settings live in [`voices/voices.json`](voices/voices.json). Edit it
and send the next request: no restart, and the render cache keys on these values
so you never compare against a stale clip.

To find the right values, render the same line across a range of settings:

```bash
.venv\Scripts\python.exe tune.py akira reina
```

That writes six clips to `tune_out/<engine>/<voice>/`, sweeping the axis that
matters for that engine. Listen through them and keep the one that is clearest
while still sounding like the character, then copy its values into that voice's
engine block in `voices.json`.

If even the tightest preset is still unclear, the reference clip is the limit.
Re-record that character enunciating more deliberately — same personality, just
less swallowed consonants — and everything downstream improves at once.

### A note on language

XTTS v2 speaks 17 languages, and **Indonesian is not one of them**. That costs
nothing today because the Learner is prompted to answer in English
(`llm/prompts/learner.prompt.ts`). If you ever switch the learner to Indonesian,
set `TTS_DEFAULT_LANGUAGE=es`: Indonesian and Spanish share five pure vowels, so
a Spanish frontend reads Indonesian spelling far more faithfully than an English
one, which forces it through English phonics.

---

## Performance

Measured on this project with an RTX 4050 (6 GB), not estimated — your hardware
will differ:

| | Model load | Per reply (~25 words) |
|---|---|---|
| **Chatterbox** (default) | **26 s** | ~8 s |
| XTTS v2 | 9 min | ~5 s |

Chatterbox loads **21x faster**, which is what you feel while developing: a
restart costs half a minute instead of nine. It renders a little slower, which
you do not feel — the backend calls this from a background job the UI polls, so
the text lands first either way.

**Render time is wildly unstable on a laptop GPU, and the cause is not heat.**
The same sentence took 8 s in one run and over three minutes in another. During
the slow run `nvidia-smi` reported the GPU in **P8 at 210 MHz** — 7% of its
3105 MHz maximum — drawing 1.58 W at 0% utilisation and 40 °C, on mains power.

The GPU was parked at idle clocks while inference ran. Autoregressive decoding
issues a long stream of tiny kernels, and the driver never sees enough sustained
load to boost. Nothing in this service can fix that; it is a driver power
decision. If renders are slow, check `nvidia-smi --query-gpu=pstate,clocks.sm
--format=csv` first. Forcing "Prefer maximum performance" for `python.exe` in the
NVIDIA control panel is the usual workaround.

Treat the per-reply figure as a best case, not a guarantee. Nothing on screen
waits for it — the reply text is published before synthesis begins.

On CPU expect minutes to load and 10-30 s per reply: usable for testing, too
slow to feel live.

Repeated lines are free: rendered clips are cached by engine + text + voice +
language + settings. Changing a setting, or replacing a reference recording,
invalidates exactly what it should — so comparing two tunings by ear never
returns you a stale clip from the old one.

---

## Troubleshooting

**Install fails with a compiler or wheel error.** You are almost certainly on
Python 3.13. Check `python --version` inside the activated venv.

**The download stalls or makes no progress.** Do not judge it by file size on
Windows — an open write handle leaves the directory entry at 0 bytes until it
flushes, which makes a healthy download look frozen. Read `fetch_model.py`'s own
progress lines instead. If it genuinely stalls, it is `huggingface_hub`: the
fetcher avoids it entirely, so just re-run `fetch_model.py`.

**`device` says `cpu` but you have an NVIDIA GPU.** The CPU-only torch wheel got
installed. Reinstall torch from the CUDA index (see Setup), then check:
`python -c "import torch; print(torch.cuda.is_available())"`.

**A voice loads but is not cloned (`X-TTS-Cloned: 0`).** The file in `voices/`
is missing or misnamed; the engine fell back to its built-in voice.

**Audio plays in the wrong voice.** The character is derived from the workspace
id on both sides. `apps/backend/tests/tts.test.ts` locks the backend's
implementation to the frontend's — if that test passes, the mismatch is a
missing or misnamed file in `voices/`.

**No audio at all, but no errors.** Check, in order: `COGNIVA_TTS_ENABLED=true`
in the backend `.env`, `/health` reporting `ready: true`, and the mute toggle in
the workspace header.
