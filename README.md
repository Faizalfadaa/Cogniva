# Cogniva

A **Learning-by-Teaching** study platform — the user teaches an AI that plays
the role of a student, then receives an evaluation of how well they explained.

This repository implements **Milestone M0 (Alignment & Contracts)** and the
**M1 (end-to-end skeleton) backend** — one full teaching turn runs through the
backend orchestrator and Learner agent.
Design reference: `Cogniva_Dokumen_Arsitektur.pdf` (in Indonesian).

> Note: the architecture PDF is written in Indonesian; the code, comments, and
> contract enum values in this repo are in English for an international
> submission. See `docs/CONTRACTS.md` for the enum value mapping.

## Milestone M0 status

M0 deliverables per the document (§11): _the document, the data contracts, the
repo & scaffold, and 1–2 demo topics._

| M0 deliverable | Status | Location |
| --- | --- | --- |
| Architecture document | ✅ | `Cogniva_Dokumen_Arsitektur.pdf` |
| Data contracts (§6) | ✅ | `backend/app/contracts/`, `frontend/src/contracts/` |
| Session state machine (§4) | ✅ | `backend/app/state_machine.py` |
| REST + WebSocket API skeleton (§7) | ✅ | `backend/app/api/` |
| Frontend repo & scaffold (React+TS+Vite+Tailwind) | ✅ | `frontend/` |
| 1–2 demo topics (§6.1) | ✅ | `backend/app/data/topics/` |

## Milestone M1 status (backend)

M1 per the document (§11): _Backend + canvas + Learner — one full teaching turn
runs._ The backend half is implemented:

| M1 backend piece | Status | Location |
| --- | --- | --- |
| Orchestrator — one teaching turn end to end (§3.3, §5.1) | ✅ | `backend/app/orchestrator.py` |
| Learner agent — student persona, real LLM (§3.6) | ✅ | `backend/app/agents/learner.py` |
| Centralized LLM wrapper (§3.3, §7.3) | ✅ | `backend/app/llm/client.py` |
| WebSocket teaching loop wired (§7.2) | ✅ | `backend/app/api/websocket.py` |
| Vision / ASR | ⏳ M2 stub | `backend/app/agents/vision.py` |
| Evaluator | ⏳ M3 | placeholder in `rest.py` |

The **Learner** calls a Gemini text model (via the official `google-genai` SDK)
with a strict student persona and structured-JSON output, maintaining its
`LearnerState` across turns. It receives only the topic title/description, what
was explained, and its own state — never the answer key (`referenceMaterial` /
`keyConcepts`), structurally honoring the §1.4 invariants.

**No API key? Still runs.** Without `GEMINI_API_KEY`, the Learner uses a
deterministic in-character fallback so the end-to-end loop (and the test suite)
works offline. Set the key to get the real LLM-driven student. See
`backend/.env.example`.

Vision/ASR are M2 (the canvas-image channel); the Evaluator is M3. Those points
are marked `TODO(Mx)` in the code and return passthrough stubs / recoverable
`error` messages rather than crashing.

## Structure

```
Cogniva/
├── Cogniva_Dokumen_Arsitektur.pdf   # design reference (M0 output)
├── docs/
│   └── CONTRACTS.md                 # data-contract → code map
├── backend/                         # Python + FastAPI (modular monolith)
│   ├── app/
│   │   ├── contracts/               # Pydantic models — §6 contracts
│   │   ├── ws/messages.py           # WebSocket message contracts §7.2
│   │   ├── state_machine.py         # session state machine §4
│   │   ├── llm/                     # centralized LLM wrapper §3.3, §7.3
│   │   ├── agents/                  # Learner (real) + Vision (M2 stub) §3.4-§3.6
│   │   ├── orchestrator.py          # one teaching turn end to end §3.3, §5.1
│   │   ├── config.py                # env-driven config (model, thresholds)
│   │   ├── api/                     # REST §7.1 + WebSocket §7.2
│   │   ├── data/topics/             # curated demo topics §6.1
│   │   ├── store.py                 # in-memory store (placeholder for §8)
│   │   └── main.py                  # FastAPI entrypoint
│   ├── tests/                       # state machine, contracts, learner, orchestrator, ws
│   ├── .env.example                 # GEMINI_API_KEY + tuning knobs
│   └── requirements.txt
└── frontend/                        # React + TypeScript + Vite + Tailwind
    └── src/
        ├── contracts/               # TS mirror of §6 contracts & §7.2 messages
        ├── api/client.ts            # thin REST client
        └── App.tsx                  # UI skeleton (loads the demo topics)
```

## Running

### Backend (port 8000)

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Interactive OpenAPI docs: http://localhost:8000/docs

Tests:

```bash
cd backend
python -m pytest
```

### Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Make sure the backend is running so the topic list loads (CORS is already
allowed for `localhost:5173` in `app/main.py`).

## Tech stack (§9)

Frontend: React + TypeScript + Vite + Tailwind · Backend: Python + FastAPI ·
Real-time: WebSocket · Storage (later): SQLite + object store.

## Contract notes

The data contracts are the single source of truth across the team (§6, §12).
Any change must be agreed with the tech lead and synced on **both** sides
(backend Pydantic ⇄ frontend TypeScript). See `docs/CONTRACTS.md`.
