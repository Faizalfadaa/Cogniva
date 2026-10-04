/**
 * The student answers to the name of the character on screen.
 *
 * The prompt used to call every student "Iva", so the user picked Yuzuki,
 * saw Yuzuki, heard Yuzuki's voice, asked her name, and was told "My name is
 * Iva". These tests hold the name to the character from the picker through to
 * the prompt, on both paths a message reaches the student: the board and the
 * chat panel.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.USE_MOCK_AI = "true";
  process.env.GEMINI_API_KEY = "";
  process.env.GOOGLE_API_KEY = "";
});
vi.mock("../src/modules/auth/authService.js", () => ({
  getCurrentUser: vi.fn(async () => undefined),
}));

import { LearnerAgent, type RespondArgs } from "../src/agents/learner/index.js";
import { workspaceRoutes } from "../src/api/rest/workspaces.js";
import { buildLearnerMessages } from "../src/llm/prompts/learner.prompt.js";
import {
  LEARNER_NAMES,
  LEARNER_VOICES,
  learnerNameForWorkspace,
  voiceForWorkspace,
} from "../src/modules/tts/index.js";
import type { LearnerState } from "../src/contracts/learner.js";

const state: LearnerState = {
  sessionId: "ses_name",
  understoodConcepts: [],
  activeMisconceptions: [],
  openGaps: [],
  questionsAsked: [],
  updatedAtTurn: 0,
};

function system(learnerName?: string): string {
  return buildLearnerMessages({
    sessionId: "ses_name",
    turnIndex: 1,
    teachingText: "what is your name?",
    currentState: state,
    learnerName,
  }).find((m) => m.role === "system")!.content;
}

describe("learner prompt", () => {
  it("gives the student the character's name, not Iva", () => {
    const prompt = system("Yuzuki Akatsuki");

    expect(prompt).toContain('You are "Yuzuki Akatsuki"');
    expect(prompt).toContain("Your name is Yuzuki Akatsuki");
    expect(prompt).not.toMatch(/\bIva\b/);
  });

  it("keeps a name of its own where there is no character to match", () => {
    expect(system(undefined)).toContain('You are "Iva"');
    expect(system("  ")).toContain('You are "Iva"');
  });
});

describe("learnerNameForWorkspace", () => {
  it("names the character the user picked", () => {
    expect(learnerNameForWorkspace("reina", "ws_any")).toBe("Reina Kisaragi");
  });

  it("agrees with the voice when nothing was picked", () => {
    // The fallback character is derived from the id; the name has to be that
    // same character's, or the face, voice and name disagree.
    for (const id of ["ws_1a2b3c4d", "ws_0c2e46ac", "ws_800efbc7"]) {
      expect(learnerNameForWorkspace(undefined, id)).toBe(
        LEARNER_NAMES[voiceForWorkspace(undefined, id)],
      );
    }
  });

  it("uses the names the frontend shows", () => {
    // Read from the frontend itself, so renaming a character there without
    // renaming it here fails this test instead of shipping a student that
    // introduces itself by an old name.
    const source = readFileSync(
      fileURLToPath(new URL("../../frontend/src/lib/Learner.ts", import.meta.url)),
      "utf-8",
    );
    const shown = Object.fromEntries(
      [...source.matchAll(/id:\s*'(\w+)',\s*name:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]),
    );

    for (const id of LEARNER_VOICES) {
      expect(LEARNER_NAMES[id]).toBe(shown[id]);
    }
  });
});

describe("the name reaches the student", () => {
  const app = Fastify();
  const guest = { "x-guest-session": "guest-session-learner-name" };
  const respond = vi.spyOn(LearnerAgent.prototype, "respond");

  beforeAll(async () => {
    await app.register(workspaceRoutes, { prefix: "/api" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    respond.mockRestore();
  });

  async function waitFor(url: string, ready: (body: any) => boolean) {
    for (let i = 0; i < 200; i++) {
      const response = await app.inject({ method: "GET", url, headers: guest });
      if (response.statusCode === 200 && ready(response.json())) return response.json();
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out: ${url}`);
  }

  /** The names the student was handed, in call order. */
  const namesGiven = () =>
    respond.mock.calls.map(([args]) => (args as RespondArgs).learnerName);

  it("on both the board and the chat, as the character that was picked", async () => {
    const created = await app.inject({ method: "POST", url: "/api/workspaces", headers: guest });
    const url = `/api/workspaces/${created.json().id}`;
    await app.inject({ method: "PATCH", url, headers: guest, payload: { learnerId: "yuzuki" } });
    respond.mockClear();

    // The board.
    await app.inject({
      method: "POST",
      url: `${url}/checkpoints`,
      headers: guest,
      payload: { snapshotImage: "iVBORw0KGgo=", snapshotMime: "image/png", whiteboardSnapshot: {} },
    });
    await waitFor(`${url}/checkpoints`, (rows) => rows.some((row: any) => row.learnerResponse));

    // The chat, with the question from the report.
    await app.inject({
      method: "POST",
      url: `${url}/messages`,
      headers: guest,
      payload: { content: "what is your name?" },
    });
    await waitFor(`${url}/messages`, (rows) => rows.filter((m: any) => m.sender === "learner").length >= 2);

    expect(namesGiven().length).toBeGreaterThanOrEqual(2);
    expect(new Set(namesGiven())).toEqual(new Set(["Yuzuki Akatsuki"]));
  });
});
