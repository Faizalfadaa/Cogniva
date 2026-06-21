# Cogniva

A **Learning-by-Teaching** study platform — the user teaches an AI that plays
the role of a student, then receives an evaluation of how well they explained.

This repository is the **Milestone M0 (Alignment & Contracts) scaffold**.
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

The AI agent logic (Vision, ASR, Learner, Evaluator) is **not** implemented yet —
that is M1+ scope. Those points are marked `TODO(Mx)` in the code and, for M0,
return placeholders / recoverable `error` messages rather than crashing.

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
│   │   ├── api/                     # REST §7.1 + WebSocket §7.2
│   │   ├── data/topics/             # curated demo topics §6.1
│   │   ├── store.py                 # in-memory store (placeholder for §8)
│   │   └── main.py                  # FastAPI entrypoint
│   ├── tests/                       # state-machine & contract tests
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
