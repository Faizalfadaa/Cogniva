import { describe, it, expect } from "vitest";

import type { LLM, StructuredArgs } from "../../../llm/index.js";
import { runEvaluator } from "../evaluator.js";
import type { EvaluatorInput } from "../types.js";

const baseInput: EvaluatorInput = {
  sessionId: "sess-1",
  turns: [
    {
      turnIndex: 0,
      boardText: "Photosynthesis converts sunlight into glucose.",
      learnerUtterance: "Jadi cahayanya diubah jadi gula?",
    },
  ],
  referenceMaterial: "Plants make glucose using sunlight, water and carbon dioxide.",
  keyConcepts: [
    "Photosynthesis converts sunlight into glucose",
    "Plants release oxygen",
  ],
  commonMisconceptions: ["Plants eat dirt"],
};

/** A tiny LLM seam stub so the real path runs without the SDK. */
function fakeLLM(impl: (args: StructuredArgs) => Promise<Record<string, unknown>>): LLM {
  return { structured: impl };
}

describe("runEvaluator (offline / mock)", () => {
  it("scores by keyword coverage and uses English finding categories", async () => {
    const result = await runEvaluator(baseInput, "ev_test1234", { useMock: true });

    expect(result.evaluationId).toBe("ev_test1234");
    expect(result.sessionId).toBe("sess-1");
    expect(result.score).toBeGreaterThan(0); // "glucose"/"sunlight" covered in turn 0
    expect(result.score).toBeLessThanOrEqual(100);
    // First concept is covered (CORRECT), second is missed (MISSED).
    const categories = result.findings.map((f) => f.category);
    expect(categories).toContain("CORRECT");
    expect(categories).toContain("MISSED");
    for (const c of categories) {
      expect(["CORRECT", "WRONG", "MISSED", "CONFUSING"]).toContain(c);
    }
  });

  it("returns score 0 with no recorded turns", async () => {
    const result = await runEvaluator(
      { ...baseInput, turns: [] },
      "ev_empty",
      { useMock: true },
    );
    expect(result.score).toBe(0);
  });
});

describe("runEvaluator (real path via injected LLM)", () => {
  it("normalizes and clamps the model output", async () => {
    const llm = fakeLLM(async () => ({
      score: 130, // out of range -> clamped to 100
      summary: "Penjelasan kuat di tahap terang.",
      strengths: ["alur cahaya", ""], // empty entry dropped
      improvements: ["tambahkan siklus Calvin"],
      findings: [
        { category: "CORRECT", concept: "klorofil", detail: "tepat", evidenceTurnIndex: 0 },
        { category: "BOGUS", concept: "x", detail: "y", evidenceTurnIndex: 0 }, // dropped
      ],
    }));

    const result = await runEvaluator(baseInput, "ev_real", { llm });

    expect(result.score).toBe(100);
    expect(result.strengths).toEqual(["alur cahaya"]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe("CORRECT");
  });

  it("falls back to the deterministic evaluator when the LLM throws", async () => {
    const llm = fakeLLM(async () => {
      throw new Error("network down");
    });

    const result = await runEvaluator(baseInput, "ev_fallback", { llm });

    // Fallback still yields a valid, renderable result rather than throwing.
    expect(result.evaluationId).toBe("ev_fallback");
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
