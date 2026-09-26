/**
 * The chat panel is teaching, and the Evaluator has to read it.
 *
 * Board and chat are two separate streams in storage and only the first ever
 * reached the Evaluator, so a concept the user explained only by answering the
 * student's question was scored MISSED, and one they explained wrongly there
 * cost them nothing.
 *
 * These tests drive the real REST flow and capture what the Evaluator was
 * handed: that the chat arrives at all, and that each message lands on the turn
 * whose board was on screen when it was sent rather than on whichever turn
 * shares its position in a list.
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
const guest = { "x-guest-session": "guest-session-evaluator-chat" };

/**
 * Per-test ceiling, well above vitest's 5s default.
 *
 * Each test drives the real thing: a board goes in, the student answers it in
 * the background, a message goes in, the student answers that too, and only
 * then does the session finish. Every one of those is a poll with its own
 * budget, and on a cold run (first file executed, caches empty) they add up
 * past five seconds even though nothing is wrong. A test that fails on the
 * first run of the morning and passes for the rest of the day teaches people
 * to rerun instead of to read.
 */
const SLOW = 30_000;

/** The input the Evaluator was handed on the last finish. */
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

/** Draw a board and wait until the student has answered it. */
async function teach(url: string, turnsSoFar: number) {
  const response = await app.inject({
    method: "POST",
    url: `${url}/checkpoints`,
    headers: guest,
    payload: { snapshotImage: "iVBORw0KGgo=", snapshotMime: "image/png", whiteboardSnapshot: {} },
  });
  expect(response.statusCode).toBe(201);
  await waitFor(
    `${url}/checkpoints`,
    (rows) => rows.length > turnsSoFar && rows.every((row: any) => row.learnerResponse),
  );
}

/** Type a message and wait until the student has replied to it. */
async function chat(url: string, content: string, messagesSoFar: number) {
  const response = await app.inject({
    method: "POST",
    url: `${url}/messages`,
    headers: guest,
    payload: { content },
  });
  expect(response.statusCode).toBe(201);
  // The user's own bubble plus the student's reply.
  await waitFor(`${url}/messages`, (rows) => rows.length >= messagesSoFar + 2);
}

it("hands the Evaluator each chat message on the turn it was sent during", async () => {
  const created = await app.inject({ method: "POST", url: "/api/workspaces", headers: guest });
  expect(created.statusCode).toBe(201);
  const url = `/api/workspaces/${created.json().id}`;

  await teach(url, 0);
  // One message per turn, each naming its turn so the grouping is checkable
  // without depending on what the mock student says back.
  await chat(url, "ATP is the battery, not the sugar.", 1);

  await teach(url, 1);
  await chat(url, "The Calvin cycle runs in the stroma.", 4);

  expect((await app.inject({ method: "POST", url: `${url}/finish`, headers: guest })).statusCode)
    .toBe(204);
  await waitFor(`${url}/report`, (body) => Boolean(body.letter));

  expect(captured).toBeDefined();
  const turns = captured!.turns;
  expect(turns).toHaveLength(2);

  // Each user line sits under the board that was on screen when it was typed.
  const userSaid = (turnIndex: number) =>
    (turns[turnIndex].chat ?? [])
      .filter((message) => message.sender === "user")
      .map((message) => message.text);

  expect(userSaid(0)).toEqual(["ATP is the battery, not the sugar."]);
  expect(userSaid(1)).toEqual(["The Calvin cycle runs in the stroma."]);

  // The student's side comes too: the user's reply is unjudgeable without the
  // question it answers.
  expect(turns[0].chat!.some((message) => message.sender === "learner")).toBe(true);
}, SLOW);

it("carries the exchange into the report the debrief screen reads", async () => {
  const created = await app.inject({ method: "POST", url: "/api/workspaces", headers: guest });
  const url = `/api/workspaces/${created.json().id}`;

  await teach(url, 0);
  await chat(url, "Chlorophyll reflects green, which is why leaves look green.", 1);

  expect((await app.inject({ method: "POST", url: `${url}/finish`, headers: guest })).statusCode)
    .toBe(204);
  const report = await waitFor(`${url}/report`, (body) => Boolean(body.letter));

  const chatInReport = report.transcript?.[0]?.chat ?? [];
  expect(chatInReport.map((message: any) => message.text)).toContain(
    "Chlorophyll reflects green, which is why leaves look green.",
  );
}, SLOW);
