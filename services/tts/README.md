# Cogniva voice service

Gives the AI learner a spoken voice, cloned from a short reference recording.

This is a **separate Python process**. These are PyTorch models with no usable
Node binding, so the backend calls it over HTTP and falls back to silence when it
is not running. Nothing in the app breaks when this service is off.

Three engines, chosen with `TTS_ENGINE`:

| | Licence | Notes |
|---|---|---|
| **`chatterbox-turbo`** (default) | MIT | Resemble AI. The same cloning at about twice the speed on this project's laptop GPU: a reply's first sentence is ready in ~2 s instead of ~4 s, and each sentence renders faster than it plays. Ignores `exaggeration` and `cfg_weight`, so the per-voice delivery tuning does not apply. |
| `chatterbox` | MIT | The original. Slower here, but it honours the per-voice delivery tuning in `voices.json`. |
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

# Weights for the default engine, Turbo (~2.9 GB, resumable — safe to re-run)
.venv\Scripts\python.exe fetch_model.py

# Optional: the original Chatterbox, for TTS_ENGINE=chatterbox (~3.2 GB)
.venv\Scripts\python.exe fetch_model.py --engine chatterbox
```

`fetch_model.py` writes each engine's weights into `models/<engine>/` — about
2.9 GB for Turbo, 3.2 GB for the original, once each. It resumes a partial
download and retries with backoff, so it is safe to interrupt and re-run. A
`.part` file is promoted to the real filename only after the full declared length
has arrived — an interrupted run can never leave a truncated file that looks
complete.

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
| `TTS_ENGINE` | `chatterbox-turbo` | `chatterbox-turbo`, `chatterbox` or `xtts` |
| `TTS_MODELS_DIR` | `./models` | Where fetch_model.py puts the weights |
| `TTS_EXAGGERATION` | `0.5` | Chatterbox: delivery intensity |
| `TTS_CFG_WEIGHT` | `0.5` | Chatterbox: lower loosens pacing |
| `TTS_MAX_TEXT_CHARS` | `800` | Longer input is cut at a sentence end |
| `TTS_CACHE_MAX_ENTRIES` | `500` | Rendered clips kept on disk |
| `TTS_WARM_ON_STARTUP` | `true` | Set false for a fast boot, slow first request |
| `TTS_WARM_RENDER` | `true` | Render one line per voice before reporting ready |
| `TTS_PROCESS_PRIORITY` | `abovenormal` | Windows: `normal`, `abovenormal` or `high` — see Performance |
| `TTS_DISABLE_ECOQOS` | `true` | Windows: opt the process out of power throttling |
| `TTS_PROGRESS_BARS` | unset | `1` shows the per-decode progress bar in the log |
| `TTS_PORT` | `8020` | |

### Fixing unclear pronunciation

**These knobs apply to `chatterbox` and `xtts`.** Turbo ignores `exaggeration`,
`cfg_weight` and `min_p`, so tuning a voice by ear means either switching the
engine or improving the reference recording.

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

Measured on this project with an RTX 4050 laptop GPU (6 GB) and an i7-13650HX,
not estimated — your hardware will differ:

| | Model load | Per reply (~7 s of audio) | First sentence ready |
|---|---|---|---|
| **`chatterbox-turbo`** (default) | ~20 s | ~3.5 s (RTF 0.43–0.49) | ~1.7 s |
| `chatterbox` | ~25 s | ~7 s (RTF ~1.0) | ~5 s |
| XTTS v2 | 9 min | ~5 s | — |

RTF is render time divided by audio length: at 1.0 the model renders exactly as
fast as it speaks. The backend voices a reply **one sentence at a time**, and the
UI reveals each sentence's text as its clip starts playing — so what the user
waits for is the first sentence, not the whole reply. "First sentence ready" is
from a two-sentence line rendered back to back.

Measured end to end through the app, on the same chat message:

| | First clip, after the reply text | Between sentences |
|---|---|---|
| `chatterbox-turbo` | 2.2 s | no gap — each clip was ready before the one before it finished |
| `chatterbox` | 4.4 s | 1.7 s of silence waiting for the next clip |

That gap is why Turbo is the default: below RTF 1.0 the renderer stays ahead of
the voice, and a reply comes out as one continuous line.

The ratios in the first table are the model alone. Through the service each
request also pays HTTP, WAV encoding and the watermarker, which on a single short
sentence put Turbo nearer RTF 0.8 — still under 1.0, which is what keeps a reply
continuous.

### Windows was running this service at a fraction of its speed

Started in the background, the service decoded at **~6 steps/s** with the GPU
mostly in **P4**, rendering at RTF 2.7–5.2: a reply of about 7 seconds took 20 to
40 seconds. The same model run in the foreground did ~35 steps/s. Nothing was
wrong with the GPU or the model.

On a hybrid CPU (performance and efficiency cores) under the Balanced power plan,
Windows schedules background work for efficiency. Autoregressive decoding spends
much of each step dispatching small GPU kernels from Python, so when that thread
is slowed the GPU waits between kernels and drops to a low power state. Raising
the priority of the service while it was running moved it to RTF ~1.0 at once.

So the service tunes its own scheduling at startup
([`app/process_tuning.py`](app/process_tuning.py)): it opts out of EcoQoS and
raises itself to AboveNormal. From a fresh background start with that in place,
replies rendered at RTF 0.99–1.05 with the GPU held in P0, and the per-voice
warm-up renders took 3–8 s.

An earlier version of this section blamed the NVIDIA driver for parking the GPU
at idle clocks (P8), and suggested "Prefer maximum performance" in the NVIDIA
control panel. That reading was a symptom — a GPU with nothing to do — not the
cause, and that setting is not needed.

Nothing on screen depends on these numbers being met. If a sentence's clip has
not arrived within 8 seconds, the UI shows its text anyway and moves on.

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

**Audio plays in the wrong voice.** The voice follows the student picked for the
workspace (`workspace.learner_id`), falling back to one derived from the
workspace id when nobody picked. `apps/backend/tests/tts.test.ts` locks the
backend's choice to what the frontend draws — if that test passes, the mismatch
is a missing or misnamed file in `voices/`. A workspace whose student was picked
before `learner_id` existed keeps the fallback until the student is picked again.

**Replies render far slower than real time on Windows.** Check the service log
for `process tuning: priority=abovenormal, ecoqos disabled=True`, then confirm the
process really runs at that priority:
`Get-Process -Id (Get-NetTCPConnection -LocalPort 8020 -State Listen).OwningProcess | Select-Object PriorityClass`.
If it does and renders are still slow, try `TTS_PROCESS_PRIORITY=high`.

**No audio at all, but no errors.** Check, in order: `COGNIVA_TTS_ENABLED=true`
in the backend `.env`, `/health` reporting `ready: true`, and the mute toggle in
the workspace header. If a reply's text appears but its voice never follows, its
first clip took longer than the 8 seconds the UI waits — see Performance.
