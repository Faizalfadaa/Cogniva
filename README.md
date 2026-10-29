# Cogniva

<img width="900" height="600" alt="Cogniva preview" src="https://github.com/user-attachments/assets/75fa83c8-64a3-47d5-abda-393b8bbbb871" />

Cogniva is a **Learning-by-Teaching** study platform where users learn by
explaining a topic to an AI learner. The user prepares material in a workspace,
teaches through a whiteboard and chat-based interaction, receives questions from
the AI learner, and gets an evaluation of their explanation at the end of the
session.

The application is built as a small monorepo with a React frontend and a
Fastify backend. The backend can use Gemini through the official
`@google/genai` SDK for real AI responses, while still supporting mock mode for
offline development and testing.

## Features

- Workspace creation and management
- Interactive whiteboard for writing and drawing teaching material
- AI learner persona that responds like a student
- Chat interaction for follow-up questions and clarification
- Teaching checkpoint submission with whiteboard and optional audio input
- Reference material for the evaluation — upload a PDF, paste your own notes, or
  let the reference agent search for sources and offer you a few options
- Spoken learner replies through ElevenLabs (optional)
- Session evaluation report after the learning session is completed
- Mock AI fallback when no Gemini API key is configured

## Tech Stack

- Frontend: React, TypeScript, Vite, Excalidraw
- Backend: Node.js, TypeScript, Fastify, Zod
- Database: PostgreSQL via Prisma
- AI provider: Gemini via `@google/genai`
- Voice: ElevenLabs over HTTP — optional
- Testing: Vitest

## Project Structure

```text
Cogniva/
|-- apps/
|   |-- backend/
|   |   |-- src/
|   |   |   |-- agents/          # Planner, learner, vision, ASR, evaluator agents
|   |   |   |-- api/             # REST and WebSocket endpoints
|   |   |   |-- config/          # Environment-based runtime config
|   |   |   |-- contracts/       # Zod schemas and shared backend types
|   |   |   |-- llm/             # Gemini client and prompts
|   |   |   |-- modules/         # Workspace, session, topic, and storage logic
|   |   |   |-- orchestrator/    # Teaching turn supervision (executes the planner's steps)
|   |   |   |-- app.ts           # Fastify app factory
|   |   |   `-- main.ts          # Backend entrypoint
|   |   |-- tests/               # Backend tests and demos
|   |   |-- .env.example
|   |   `-- package.json
|   `-- frontend/
|       |-- public/              # Static assets
|       |-- src/
|       |   |-- bridge/          # Frontend bridge to real or mock backend
|       |   |-- dto/             # Frontend DTO types
|       |   |-- features/        # UI features
|       |   |-- routes/          # App routes
|       |   `-- main.tsx
|       `-- package.json
|-- caddy/
|   `-- Caddyfile                # Reverse proxy and HTTPS configuration
|-- packages/
|-- scripts/
`-- README.md
```

## Prerequisites

Install these before running the project:

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer — or Docker, which brings its own (see [Database](#database))
- A Gemini API key, if you want to use real AI responses

You can still run the project without an API key. In that case, the backend uses
mock AI responses. A database, however, is required.

## Database

Cogniva stores everything in PostgreSQL — workspaces, sessions, teaching
checkpoints, chat, transcripts, and the debrief report. The backend will not
start without a `DATABASE_URL`; there is no local-file or in-memory fallback.

The quickest way to get one is Docker Compose, which brings up Postgres, applies
the migrations and starts the app together:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

To run the backend directly instead, point it at a Postgres you already have and
create the tables once:

```powershell
cd apps/backend
Copy-Item .env.example .env      # then set DATABASE_URL
npm install                       # also generates the Prisma client
npm run db:migrate                # create/update the tables
```

Useful commands:

- `npm run db:migrate` — apply pending migrations (safe to re-run).
- `npm run db:generate` — regenerate the Prisma client after a schema change.
- `npm run db:studio` — browse the data in Prisma Studio.

## Environment Setup

Create the backend environment file:

```powershell
cd apps/backend
Copy-Item .env.example .env
```

Open `apps/backend/.env` and configure the values you need:

```env
DATABASE_URL=postgresql://cogniva:cogniva@localhost:5432/cogniva?schema=public
GEMINI_API_KEY=your_gemini_api_key_here
USE_MOCK_AI=false
COGNIVA_LEARNER_MODEL=gemini-2.5-flash
PORT=8000
```

Important environment variables:

- `DATABASE_URL`: PostgreSQL connection string. Required — see [Database](#database).
- `GEMINI_API_KEY`: Enables real Gemini-powered AI responses.
- `USE_MOCK_AI`: Set to `false` to use Gemini, or `true` to force mock AI.
- `COGNIVA_LEARNER_MODEL`: Gemini model used by the learner agent.
- `PORT`: Backend server port. The frontend expects `8000` by default.
- `ELEVENLABS_API_KEY`: Speak the learner's replies. Setting it turns the voice
  on; there is nothing else to run. See
  [Learner voice](#3-learner-voice-optional).
- `COGNIVA_ELEVENLABS_VOICE_ID`: One voice for all three students, or
  `COGNIVA_ELEVENLABS_VOICE_YUZUKI` / `_REINA` / `_AKIRA` for one each. List the
  ids on your key with `npm run tts:voices` in `apps/backend`.
- `COGNIVA_TTS_ENABLED`: Follows the key above. Set it to `false` to silence the
  voice without unsetting the key.

Every other knob is listed with a comment in `apps/backend/.env.example`, and
they are all read in one place, `apps/backend/src/config/index.ts`.

If the backend starts on a different port, either change `PORT=8000` in the
backend `.env` file or configure the frontend with `VITE_API_BASE`.

Optional frontend environment file:

```powershell
cd apps/frontend
New-Item .env.local
```

Example `apps/frontend/.env.local`:

```env
VITE_API_BASE=http://localhost:8000
VITE_USE_MOCK=false
```

## Running the Application

Two terminals are enough for the whole app. The learner's voice is an API key,
not a third process.

There is no root `package.json` and no workspace tooling, so every `npm` command
has to run from inside `apps/backend` or `apps/frontend`.

### 1. Backend

See [Database](#database) first — it needs `DATABASE_URL` and a migrated
database.

```powershell
cd apps/backend
npm install
npm run db:migrate
npm run dev
```

Run `npm run db:migrate` again after pulling changes from someone else. It only
applies what is missing and is safe to re-run; skipping it leaves the schema
behind the code, which shows up as write failures rather than a startup error.

The backend should print:

```text
Cogniva backend terhubung ke Postgres
Cogniva backend listening on http://localhost:8000
```

If it exits with `DATABASE_URL belum diisi`, the connection string is missing
from `apps/backend/.env`.

Check the backend health endpoint:

```text
http://localhost:8000/health
```

### 2. Frontend

```powershell
cd apps/frontend
npm install
npm run dev
```

Open the frontend in your browser:

```text
http://localhost:5173
```

That is the app, fully working — whiteboard, learner, chat, reference material
and the evaluation report. The learner is silent until you add a voice key
below.

### 3. Learner voice (optional)

The student speaks through the ElevenLabs API. There is nothing to install and
nothing to start: the backend calls it over HTTP, and the voice is best-effort —
no key, a spent quota, a slow or broken call all mean "no audio this time" while
the reply still arrives as text.

Put the key in `apps/backend/.env`:

```env
ELEVENLABS_API_KEY=sk_...
```

Voice ids belong to your account, so there is no default to ship. List the ones
on your key — it prints each id next to the variable it goes in:

```powershell
cd apps/backend
npm run tts:voices
```

Then assign one per student (or `COGNIVA_ELEVENLABS_VOICE_ID` for all three) and
restart the backend:

```env
COGNIVA_ELEVENLABS_VOICE_YUZUKI=...
COGNIVA_ELEVENLABS_VOICE_REINA=...
COGNIVA_ELEVENLABS_VOICE_AKIRA=...
```

That is the whole setup: with a key present the voice switches itself on, in
whichever language the session runs in. `COGNIVA_TTS_ENABLED=false` silences it
without unsetting the key, and every other knob (model, audio format, delivery
settings) is commented in `apps/backend/.env.example`.

There used to be a local voice service here (`services/tts`: Chatterbox and XTTS
behind FastAPI). It was removed — it needed a GPU to be worth using and could not
speak Indonesian, so the audience this product is built for could never hear it.

With the voice on, a reply is spoken one sentence at a time and its text
appears in step: each sentence shows up as its clip starts playing, with
nothing to press. If a clip takes longer than 8 seconds, the text is shown anyway.

### Everything at once, with Docker

From the repository root, this brings up Postgres, applies the migrations, and
serves the frontend behind Caddy:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

For the learner's voice, put `ELEVENLABS_API_KEY` and a voice id in the root
`.env` before bringing the stack up. There is no voice container: the backend
calls the API directly, so a host with no GPU is no obstacle.

## Using Real AI

To use real Gemini responses:

1. Put a valid Gemini API key in `apps/backend/.env`.
2. Set `USE_MOCK_AI=false`.
3. Make sure the backend is running.
4. Use the app from the frontend.

You can also test the learner agent directly from the backend:

```powershell
cd apps/backend
npm run chat:learner
```

If the AI is connected correctly, the command shows Gemini mode. If no API key
is found, it falls back to mock mode.

## Testing

Run backend tests. These use in-memory store doubles, so no database is needed:

```powershell
cd apps/backend
npm test
```

Run the database suite, which exercises the real PostgreSQL path. It needs a
`DATABASE_URL` pointing at a migrated database and cleans up its own rows:

```powershell
cd apps/backend
npm run test:db
```

Run backend type checking:

```powershell
cd apps/backend
npm run typecheck
```

Build the frontend:

```powershell
cd apps/frontend
npm run build
```

## Demo Scripts

The backend includes a few demo scripts for testing individual AI features:

```powershell
cd apps/backend
npm run chat:learner
npm run demo:learner
npm run demo:vision -- ./gambar-uji/papan1.jpeg "Photosynthesis"
npm run demo:asr -- ./path-to-audio.wav "Photosynthesis"
npm run demo:referencer -- "Photosynthesis"
```

Some demos default to mock mode so they can run without an API key. Set
`USE_MOCK_AI=false` in `.env` when you want to call Gemini.

## Main User Flow

1. Open the frontend.
2. Create a new workspace and pick a student.
3. Say what you are teaching. The same panel offers reference material for the
   evaluation — paste your own notes, upload a PDF, or let the agent search and
   choose from what it finds. This is optional; you can skip it and start.
4. Add teaching material on the whiteboard.
5. Submit a teaching checkpoint.
6. Read the AI learner response — and hear it, if the voice service is running.
7. Continue the discussion through chat.
8. Finish the session.
9. Review the generated evaluation report.

Reference material only ever reaches the evaluator, never the learner. The
student you are teaching does not get to read the answer key.

## Troubleshooting

### Frontend says "Can't connect"

Make sure the backend is running on the same port expected by the frontend. The
default is:

```text
http://localhost:8000
```

If the backend prints a different port, update `PORT=8000` in
`apps/backend/.env`, restart the backend, and refresh the frontend.

### Browser shows "Route not found"

This is normal if you open the backend root URL directly. Use the health
endpoint instead:

```text
http://localhost:8000/health
```

### AI still uses mock responses

Check these values in `apps/backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
USE_MOCK_AI=false
```

Then restart the backend.

### A write fails, but the backend started fine

The schema is probably behind the code — a migration arrived with someone else's
changes and was never applied. The backend only checks that it can *connect* at
startup, so this surfaces as a failing request rather than a failed boot:

```powershell
cd apps/backend
npm run db:migrate
```

### The learner never speaks

Work through these in order:

1. `ELEVENLABS_API_KEY` must be in `apps/backend/.env`, with the backend
   restarted since you set it.
2. A voice id must be set for the student on screen — run `npm run tts:voices`
   in `apps/backend` to list the ids on your key and the variables they go in.
   Without one the backend logs exactly which variable is missing.
3. Check the mute toggle in the workspace header — it is remembered per browser.
4. Out of characters on your plan is a 402 from the API; `npm run tts:voices`
   prints what the plan has left.

Silence is the designed failure mode: the backend never lets a voice problem
cost you the reply, so nothing here shows up as an error in the UI. The backend
log is where a failed synthesis is reported, with the reason.

