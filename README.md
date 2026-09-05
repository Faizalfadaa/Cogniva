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
- Session evaluation report after the learning session is completed
- Mock AI fallback when no Gemini API key is configured

## Tech Stack

- Frontend: React, TypeScript, Vite, tldraw
- Backend: Node.js, TypeScript, Fastify, Zod
- Database: PostgreSQL via Prisma
- AI provider: Gemini via `@google/genai`
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

Run the backend in the first terminal (see [Database](#database) first — it
needs `DATABASE_URL` and a migrated database):

```powershell
cd apps/backend
npm install
npm run dev
```

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

Run the frontend in a second terminal:

```powershell
cd apps/frontend
npm install
npm run dev
```

Open the frontend in your browser:

```text
http://localhost:5173
```

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
```

Some demos default to mock mode so they can run without an API key. Set
`USE_MOCK_AI=false` in `.env` when you want to call Gemini.

## Main User Flow

1. Open the frontend.
2. Create a new workspace.
3. Add teaching material on the whiteboard.
4. Submit a teaching checkpoint.
5. Read the AI learner response.
6. Continue the discussion through chat.
7. Finish the session.
8. Review the generated evaluation report.

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

