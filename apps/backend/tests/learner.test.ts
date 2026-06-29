/**
 * Learner agent tests (Architecture Document §3.6, §6.7, §6.8).
 *
 * The learning logic comes from the team's module (runLearnerTurn + guard +
 * mock); this suite exercises it through the orchestrator's adapter and the
 * guard directly, in deterministic mock mode (no network, no API key).
 */

import { describe, expect, it, vi } from "vitest";

import { LearnerAgent, seedLearnerState, seedLearnerStateFromEvaluation } from "../src/agents/index.js";
import type { EvaluationResult } from "../src/contracts/evaluation.js";
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

describe("seedLearnerStateFromEvaluation (adaptive resume)", () => {
  function evalResult(findings: EvaluationResult["findings"], improvements: string[] = []): EvaluationResult {
    return {
      evaluationId: "ev_1",
      sessionId: "ses_1",
      score: 60,
      findings,
      summary: "ringkasan",
      strengths: [],
      improvements,
      generatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  it("re-aims the Learner at the user's weak spots from the last evaluation", () => {
    const seeded = seedLearnerStateFromEvaluation(
      "ses_1",
      evalResult(
        [
          { category: "CORRECT", concept: "Definisi dasar", detail: "tersampaikan", evidenceTurnIndex: 0 },
          { category: "WRONG", concept: "Arah reaksi", detail: "membalik sebab dan akibat", evidenceTurnIndex: 1 },
          { category: "MISSED", concept: "Peran cahaya", detail: "belum dibahas", evidenceTurnIndex: null },
        ],
        ["Bahas peran enzim"],
      ),
    );

    // CORRECT -> understood (won't be re-probed)
    expect(seeded.understoodConcepts).toContain("Definisi dasar");
    // WRONG -> active misconception to correct by re-teaching
    expect(seeded.activeMisconceptions).toEqual([
      { concept: "Arah reaksi", belief: "membalik sebab dan akibat" },
    ]);
    // MISSED/CONFUSING + improvements -> open gaps to ask about
    expect(seeded.openGaps).toEqual(expect.arrayContaining(["Peran cahaya", "Bahas peran enzim"]));
  });

  it("keeps the carried-over memory when the evaluation has no findings", () => {
    const previous = {
      sessionId: "ses_1",
      understoodConcepts: ["X"],
      activeMisconceptions: [{ concept: "Y", belief: "z" }],
      openGaps: ["g"],
      questionsAsked: ["q"],
      updatedAtTurn: 3,
    };
    const seeded = seedLearnerStateFromEvaluation("ses_1", evalResult([]), previous);
    expect(seeded).toEqual(previous);
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

describe("runLearnerTurn agentic loop (mock)", () => {
  it("uses the reread_board tool to investigate, then responds", async () => {
    const rereadBoard = vi.fn(async (focus: string) => `(detail) ${focus}`);

    const out = await runLearnerTurn(
      {
        sessionId: "ses_1",
        turnIndex: 1,
        teachingText: 'Yang penting di sini adalah istilah "fotosintesis".',
        currentState: freshState(),
      },
      { useMock: true, tools: { rereadBoard } },
    );

    // The student investigated the unclear term before asking (agentic tool use).
    expect(rereadBoard).toHaveBeenCalledTimes(1);
    expect(rereadBoard).toHaveBeenCalledWith("fotosintesis");
    // ...and still finalized with a valid student response.
    expect(STUDENT_TYPES).toContain(out.response.type);
    expect(out.response.text.trim()).toBeTruthy();
  });

  it("collapses to a single response when no tools are injected", async () => {
    const rereadBoard = vi.fn(async () => "(detail)");
    await runLearnerTurn(
      {
        sessionId: "ses_1",
        turnIndex: 1,
        teachingText: 'Istilah "klorofil" itu kuncinya.',
        currentState: freshState(),
      },
      { useMock: true }, // no tools
    );
    expect(rereadBoard).not.toHaveBeenCalled();
  });

  it("is bounded — never loops forever even if a tool stays available", async () => {
    const rereadBoard = vi.fn(async () => "(detail)");
    const out = await runLearnerTurn(
      {
        sessionId: "ses_1",
        turnIndex: 2,
        teachingText: 'Istilah "kloroplas" itu kuncinya.',
        currentState: freshState(),
      },
      { useMock: true, tools: { rereadBoard } },
    );
    // Dedup + step cap keep it to one investigation, then a response.
    expect(rereadBoard.mock.calls.length).toBeLessThanOrEqual(2);
    expect(STUDENT_TYPES).toContain(out.response.type);
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
