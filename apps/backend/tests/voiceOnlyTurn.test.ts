/**
 * A turn can be taught by voice alone.
 *
 * The board and the microphone are both teaching channels, but a checkpoint
 * used to require a board image, and the client cancelled Teach on an empty
 * board without a word. Explaining out loud before drawing anything, which is
 * how many people start, got no reply at all.
 *
 * These drive the real REST flow and check the three things that decide whether
 * a voice-only turn actually works: it is accepted, the student answers it, and
 * nothing is invented for the board that was never drawn on. The last is the
 * easy one to miss: an empty board reading used to be patched with a stand-in
 * sentence, which the student then reacted to and the Evaluator then graded as
 * something the user had written.
 */

import Fastify from "fastify";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.USE_MOCK_AI = "true";
  process.env.GEMINI_API_KEY = "";
  process.env.GOOGLE_API_KEY = "";
});
vi.mock("../src/modules/auth/authService.js", () => ({
  getCurrentUser: vi.fn(async () => undefined),
}));

import { setEvaluator, type EvaluatorAgent, type EvaluatorInput } from "../src/agents/evaluator/index.js";
import { workspaceRoutes } from "../src/api/rest/workspaces.js";

const app = Fastify();
const guest = { "x-guest-session": "guest-session-voice-only" };

/** See evaluatorChat.test.ts: real background jobs behind polling waits. */
const SLOW = 30_000;

let captured: EvaluatorInput | undefined;

const capturingEvaluator = {
  async evaluate(input: EvaluatorInput, evaluationId: string) {
    captured = input;
    return {
      evaluationId,
      sessionId: input.sessionId,
      score: 50,
      depthScore: 40,
      findings: [],
      summary: "ok",
      strengths: [],
      improvements: [],
      generatedAt: new Date().toISOString(),
    };
  },
} as unknown as EvaluatorAgent;

beforeAll(async () => {
  setEvaluator(capturingEvaluator);
  await app.register(workspaceRoutes, { prefix: "/api" });
  await app.ready();
});

afterAll(async () => {
  setEvaluator(null);
  await app.close();
  vi.restoreAllMocks();
});

async function waitFor(url: string, ready: (body: any) => boolean) {
  for (let i = 0; i < 200; i++) {
    const response = await app.inject({ method: "GET", url, headers: guest });
    if (response.statusCode === 200 && ready(response.json())) return response.json();
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out: ${url}`);
}

async function newWorkspace(): Promise<string> {
  const created = await app.inject({ method: "POST", url: "/api/workspaces", headers: guest });
  expect(created.statusCode).toBe(201);
  return `/api/workspaces/${created.json().id}`;
}

it("accepts a turn with a recording and no board, and the student answers it", async () => {
  const url = await newWorkspace();

  const response = await app.inject({
    method: "POST",
    url: `${url}/checkpoints`,
    headers: guest,
    payload: { audio: "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYEC", audioMime: "audio/webm", whiteboardSnapshot: {} },
  });
  expect(response.statusCode).toBe(201);
  // No image was drawn, so none is stored: an empty data URL would render as
  // a broken picture wherever the board is shown back.
  expect(response.json().snapshotImageUrl).toBe("");

  const [checkpoint] = await waitFor(`${url}/checkpoints`, (rows) =>
    rows.every((row: any) => row.learnerResponse),
  );
  expect(checkpoint.learnerResponse).toBeTruthy();
}, SLOW);

it("invents nothing for the board on a voice-only turn", async () => {
  const url = await newWorkspace();

  await app.inject({
    method: "POST",
    url: `${url}/checkpoints`,
    headers: guest,
    payload: { audio: "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYEC", audioMime: "audio/webm", whiteboardSnapshot: {} },
  });
  await waitFor(`${url}/checkpoints`, (rows) => rows.every((row: any) => row.learnerResponse));

  expect((await app.inject({ method: "POST", url: `${url}/finish`, headers: guest })).statusCode)
    .toBe(204);
  await waitFor(`${url}/report`, (body) => Boolean(body.letter));

  const [turn] = captured!.turns;
  expect(turn.boardText).toBe("");
  expect(turn.speech).toBeTruthy();
}, SLOW);

it("refuses a checkpoint that carries neither a board nor a recording", async () => {
  const url = await newWorkspace();

  const response = await app.inject({
    method: "POST",
    url: `${url}/checkpoints`,
    headers: guest,
    payload: { whiteboardSnapshot: {} },
  });

  expect(response.statusCode).toBe(400);
});
