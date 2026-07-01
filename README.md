# Cogniva
<img width="900" height="600" alt="Color Blocke (3)" src="https://github.com/user-attachments/assets/75fa83c8-64a3-47d5-abda-393b8bbbb871" />

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
| Data contracts (§6) | ✅ | `apps/backend/src/contracts/`, `apps/frontend/src/contracts/` |
| Session state machine (§4) | ✅ | `apps/backend/src/modules/session/stateMachine.ts` |
| REST + WebSocket API skeleton (§7) | ✅ | `apps/backend/src/api/` |
| Frontend repo & scaffold (React+TS+Vite+Tailwind) | ✅ | `apps/frontend/` |
| 1–2 demo topics (§6.1) | ✅ | `apps/backend/src/data/topics/` |

## Milestone M1 status (backend)

M1 per the document (§11): _Backend + canvas + Learner — one full teaching turn
runs._ The backend half is implemented:

| M1 backend piece | Status | Location |
| --- | --- | --- |
| Orchestrator — one teaching turn end to end (§3.3, §5.1) | ✅ | `apps/backend/src/orchestrator/index.ts` |
| Learner agent — student persona, real LLM (§3.6) | ✅ | `apps/backend/src/agents/learner/index.ts` |
| Centralized LLM wrapper (§3.3, §7.3) | ✅ | `apps/backend/src/llm/providers/gemini.ts` |
| WebSocket teaching loop wired (§7.2) | ✅ | `apps/backend/src/api/websocket/index.ts` |
| Vision / ASR | ⏳ M2 stub | `apps/backend/src/agents/vision/index.ts` |
| Evaluator | ⏳ M3 | placeholder in `api/rest/index.ts` |

The **Learner** calls a Gemini text model (via the official `@google/genai` SDK)
with a strict student persona and structured-JSON output, maintaining its
`LearnerState` across turns. It receives only the topic title/description, what
was explained, and its own state — never the answer key (`referenceMaterial` /
`keyConcepts`), structurally honoring the §1.4 invariants.

**No API key? Still runs.** Without `GEMINI_API_KEY`, the Learner uses a
deterministic in-character fallback so the end-to-end loop (and the test suite)
works offline. Set the key to get the real LLM-driven student. See
`apps/backend/.env.example`.

Vision/ASR are M2 (the canvas-image channel); the Evaluator is M3. Those points
are marked `TODO(Mx)` in the code and return passthrough stubs / recoverable
`error` messages rather than crashing.

## Structure

```
Cogniva/                             # monorepo (apps / packages / scripts)
├── Cogniva_Dokumen_Arsitektur.pdf   # design reference (M0 output)
├── docs/
│   └── CONTRACTS.md                 # data-contract → code map
├── packages/                        # shared packages (future)
├── scripts/                         # repo scripts (future)
└── apps/
    ├── backend/                     # TypeScript + Fastify (modular monolith)
    │   ├── src/
    │   │   ├── main.ts              # Fastify entrypoint (loads .env, listens)
    │   │   ├── app.ts               # app factory: REST + WebSocket + CORS
    │   │   ├── config/              # env-driven config (model, thresholds)
    │   │   ├── contracts/           # Zod schemas + types — §6 contracts & §7.2 messages
    │   │   ├── llm/                 # centralized LLM wrapper (providers, prompts) §3.3
    │   │   ├── agents/              # Learner (real) + Vision (M2 stub) §3.4-§3.6
    │   │   ├── orchestrator/        # one teaching turn end to end §3.3, §5.1
    │   │   ├── api/                 # rest/ §7.1 + websocket/ §7.2
    │   │   ├── modules/             # session, topic, storage (+ teaching/evaluation stubs)
    │   │   └── data/topics/         # curated demo topics §6.1
    │   ├── tests/                   # state machine, learner, llm, orchestrator, ws
    │   ├── .env.example             # GEMINI_API_KEY + tuning knobs
    │   ├── tsconfig.json
    │   └── package.json
    └── frontend/                    # React + TypeScript + Vite + Tailwind
        └── src/
            ├── contracts/           # TS mirror of §6 contracts & §7.2 messages
            ├── api/client.ts        # thin REST client
            └── App.tsx              # UI skeleton (loads the demo topics)
```

## Running

### Backend (port 8000)

```bash
cd apps/backend
npm install
npm run dev           # watch mode on :8000 (configurable via PORT)
```

Health check: http://localhost:8000/health

Tests (Vitest):

```bash
cd apps/backend
npm test
```

### Frontend (port 5173)

```bash
cd apps/frontend
npm install
npm run dev
```

Make sure the backend is running so the topic list loads (CORS is already
allowed for `localhost:5173` in `src/app.ts`).

## Tech stack (§9)

Frontend: React + TypeScript + Vite + Tailwind · Backend: TypeScript + Fastify ·
Real-time: WebSocket · Storage (later): SQLite + object store.

## Contract notes

The data contracts are the single source of truth across the team (§6, §12).
Any change must be agreed with the tech lead and synced on **both** sides
(backend Zod ⇄ frontend TypeScript). See `docs/CONTRACTS.md`.
