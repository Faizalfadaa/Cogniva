/**
 * Learner agent tests (Architecture Document §3.6, §6.7, §6.8).
 *
 * The learning logic comes from the team's module (runLearnerTurn + guard +
 * mock); this suite exercises it through the orchestrator's adapter and the
 * guard directly, in deterministic mock mode (no network, no API key).
 */

import { describe, expect, it } from "vitest";

import { LearnerAgent, seedLearnerState } from "../src/agents/index.js";
import { runLearnerTurn } from "../src/agents/learner/learner.agent.js";
import {
  createFallbackOutput,
  isLearnerTextSafe,
  normalizeLearnerOutput,
} from "../src/agents/learner/learner.guard.js";
import type { VisionInterpretation } from "../src/contracts/board.js";
import type { LearnerState } from "../src/contracts/learner.js";

const STUDENT_TYPES = ["question", "confusion", "acknowledgment", "paraphrase"];
const DERIVED = ["gap", "misconception", "new_info"];

function interp(text: string): VisionInterpretation {
  return {
    snapshotId: "snap_1",
    transcribedText: text,
    elements: [],
    confidence: 1.0,
    needsConfirmation: false,
  };
}

function freshState(sessionId = "ses_1"): LearnerState {
  return {
    sessionId,
    understoodConcepts: [],
    activeMisconceptions: [],
    openGaps: [],
    questionsAsked: [],
    updatedAtTurn: 0,
  };
}

describe("seedLearnerState", () => {
  it("seeds misconceptions from the topic only", () => {
    const state = seedLearnerState(
      "ses_1",
      ["O2 berasal dari CO2", "reaksi gelap perlu kegelapan"],
      { topicTitle: "Fotosintesis" },
    );
    expect(state.understoodConcepts).toEqual([]);
    expect(state.activeMisconceptions).toHaveLength(2);
    expect(state.activeMisconceptions[0]).toEqual({
      concept: "Fotosintesis",
      belief: "O2 berasal dari CO2",
    });
    expect(state.updatedAtTurn).toBe(0);
  });

  it("caps the seeded misconceptions at 3", () => {
    const state = seedLearnerState("ses_1", ["a", "b", "c", "d", "e"], {
      topicTitle: "T",
    });
    expect(state.activeMisconceptions).toHaveLength(3);
  });
});

describe("LearnerAgent adapter (mock mode)", () => {
  it("returns a student-role response and advances the state", async () => {
    const agent = new LearnerAgent({ forceMock: true });
    const [response, next] = await agent.respond({
      topicTitle: "Variabel",
      topicDescription: "",
      interpretation: interp("Variabel adalah tempat menyimpan nilai dalam program."),
      speech: null,
      state: freshState(),
      turnIndex: 1,
    });

    expect(STUDENT_TYPES).toContain(response.type);
    expect(DERIVED).toContain(response.derivedFrom);
    expect(response.text.trim()).toBeTruthy();
    expect(response.turnIndex).toBe(1);
    expect(next.updatedAtTurn).toBe(1);
    // Adapter normalizes the optional targetConcept to `string | null`.
    expect(response.targetConcept === null || typeof response.targetConcept === "string").toBe(true);
  });
});

describe("runLearnerTurn (mock)", () => {
  it("records the question it asks about an unclear term", async () => {
    const out = await runLearnerTurn(
      {
        sessionId: "ses_1",
        turnIndex: 2,
        teachingText: 'Yang penting di sini adalah istilah "fotosintesis".',
        currentState: freshState(),
      },
      { useMock: true },
    );

    expect(out.nextState.updatedAtTurn).toBe(2);
    expect(out.response.type).toBe("question");
    expect(out.nextState.questionsAsked).toContain(out.response.text);
  });
});

describe("learner guard", () => {
  it("flags teacher-like or overly long text as unsafe", () => {
    expect(isLearnerTextSafe("Aku masih bingung, bisa diulang?")).toBe(true);
    expect(isLearnerTextSafe("Yang benar adalah fotosintesis menghasilkan oksigen.")).toBe(false);
    expect(isLearnerTextSafe(Array(60).fill("kata").join(" "))).toBe(false);
  });

  it("coerces an invalid LLM response into a safe student shape", () => {
    const raw = {
      nextState: freshState(),
      response: { type: "lecture", text: "Hmm, aku belum paham.", derivedFrom: "whatever" },
    } as unknown as Parameters<typeof normalizeLearnerOutput>[0];

    const out = normalizeLearnerOutput(raw, {
      sessionId: "ses_1",
      turnIndex: 1,
      teachingText: "x",
      currentState: freshState(),
    });

    expect(STUDENT_TYPES).toContain(out.response.type);
    expect(DERIVED).toContain(out.response.derivedFrom);
    expect(out.nextState.updatedAtTurn).toBe(1);
  });

  it("produces an in-character fallback when the LLM fails", () => {
    const out = createFallbackOutput({
      sessionId: "ses_1",
      turnIndex: 3,
      teachingText: "",
      currentState: freshState(),
    });
    expect(["question", "confusion"]).toContain(out.response.type);
    expect(out.response.text.trim()).toBeTruthy();
    expect(out.nextState.updatedAtTurn).toBe(3);
  });
});
