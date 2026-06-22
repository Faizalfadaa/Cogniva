# Cogniva Data Contracts (Core M0 Output)

A concise document linking the **inter-component data contracts** (Architecture
Document §6) to their implementation in code. These contracts are the single
source of truth; any change must be agreed with the tech lead (§6, §12).

## Conventions

- Field names use **camelCase** on the JSON wire.
- Data is exchanged as **JSON**.
- Timestamps use **ISO-8601 (UTC)**.
- Fields marked `?` in the document are **optional**.

## Two representations that must stay in sync

| Side | Location | Form |
| --- | --- | --- |
| Backend | `apps/backend/app/contracts/` | Pydantic v2 models (snake_case + camelCase alias) |
| Frontend | `apps/frontend/src/contracts/index.ts` | TypeScript `interface` (camelCase) |

## Contract → file map

| Contract (§) | Backend | Frontend |
| --- | --- | --- |
| Topic (§6.1) | `contracts/topic.py` | `Topic` |
| Session (§6.2) | `contracts/session.py` | `Session` |
| BoardSnapshot (§6.3) | `contracts/board.py` | `BoardSnapshot` |
| VisionInterpretation + Element (§6.4) | `contracts/board.py` | `VisionInterpretation`, `Element` |
| SpeechTranscript (§6.5) | `contracts/speech.py` | `SpeechTranscript` |
| TeachingTurn (§6.6) | `contracts/teaching.py` | `TeachingTurn` |
| LearnerState + Misc (§6.7) | `contracts/learner.py` | `LearnerState`, `Misc` |
| LearnerResponse (§6.8) | `contracts/learner.py` | `LearnerResponse` |
| EvaluationResult + Finding (§6.9) | `contracts/evaluation.py` | `EvaluationResult`, `Finding` |
| WebSocket messages (§7.2) | `ws/messages.py` | `contracts/messages.ts` |

## Enum value mapping (architecture PDF → code)

The architecture PDF is written in Indonesian and specifies some enum values
verbatim. For this international submission those values are anglicized (an
agreed contract change). The mapping below keeps traceability to the document.

| Enum | PDF (Indonesian) | Code (English) |
| --- | --- | --- |
| SessionStatus | PERSIAPAN / MENGAJAR / SELESAI / EVALUASI | SETUP / TEACHING / ENDED / EVALUATED |
| Difficulty | dasar / menengah / lanjut | easy / medium / hard |
| FindingCategory | BENAR / KELIRU / TERLEWAT / MEMBINGUNGKAN | CORRECT / WRONG / MISSED / CONFUSING |

`ElementType`, `LearnerResponseType`, and `DerivedFrom` were already English in
the PDF and are unchanged.

## Session state machine (§4)

```
SETUP --start--> TEACHING --end--> ENDED --evaluate--> EVALUATED (terminal)
```

- Forward-only, no path back (§4.2).
- `teaching_input` is only valid in **TEACHING**.
- Triggering evaluation is only valid in **ENDED** and is **idempotent**.

Implementation: `apps/backend/app/state_machine.py` (tested in
`apps/backend/tests/test_state_machine.py`).

## API (§7)

- REST (session lifecycle & data): `apps/backend/app/api/rest.py`, prefix `/api`.
- WebSocket (real-time channel): `apps/backend/app/api/websocket.py`, `/ws/sessions/{id}`.

## Pedagogical invariants the contracts protect (§1.4)

1. During a session the AI stays in the **student** role (the Learner never
   corrects or lectures the user).
2. Evaluation happens only **at the end**, as a separate reflection phase.
3. The Learner **never holds the answer key** — only `commonMisconceptions`
   flow to the Learner, while the full `referenceMaterial` flows to the Evaluator.
4. The Evaluator sees the **whole session** (full transcript), not an isolated quiz.
