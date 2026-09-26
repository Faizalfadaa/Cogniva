import { describe, it, expect } from "vitest";

import type { LLM, StructuredArgs } from "../../../llm/index.js";
import { runEvaluator } from "../evaluator.js";
import { normalizeEvaluation } from "../evaluator.guard.js";
import { scoreFindings } from "../scoring.js";
import type { EvaluatorInput, Finding, TranscriptTurn } from "../types.js";

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

describe("normalizeEvaluation: depthScore", () => {
  it("clamps depthScore into 0..100 independently of the computed score", () => {
    const result = normalizeEvaluation(
      { depthScore: 140, findings: [] },
      "sess-1",
      "ev_depth",
    );

    expect(result.depthScore).toBe(100);
    // Nothing to measure: depth being high cannot lift a score no finding earned.
    expect(result.score).toBe(0);
  });

  it("defaults depthScore to 0 when the model omits it or sends junk", () => {
    expect(normalizeEvaluation({}, "s", "e").depthScore).toBe(0);
    expect(normalizeEvaluation({ depthScore: "deep" }, "s", "e").depthScore).toBe(0);
  });

  it("ignores a score the model sends anyway", () => {
    // The schema no longer asks for one, but a model is free to emit extra
    // keys. The findings decide the number, not the model's opinion of it.
    const result = normalizeEvaluation(
      {
        score: 99,
        findings: [
          { category: "WRONG", concept: "a", detail: "d", evidenceTurnIndex: 0 },
        ],
      },
      "s",
      "e",
    );

    // One WRONG and nothing else: accuracy 0, completeness 1, clarity 1.
    // (0 * 0.5) + (1 * 0.3) + (1 * 0.2) = 0.5 -> 50.
    expect(result.score).toBe(50);
  });
});

describe("scoreFindings", () => {
  const finding = (category: Finding["category"], concept: string): Finding => ({
    category,
    concept,
    detail: "",
    evidenceTurnIndex: 0,
  });

  it("scores a flawless set at 100", () => {
    expect(scoreFindings([finding("CORRECT", "a"), finding("CORRECT", "b")]).score).toBe(100);
  });

  it("weights accuracy above completeness above clarity", () => {
    // Same set size, one flaw each, so only the weight differs.
    const wrong = scoreFindings([finding("CORRECT", "a"), finding("WRONG", "b")]).score;
    const missed = scoreFindings([finding("CORRECT", "a"), finding("MISSED", "b")]).score;
    const confusing = scoreFindings([
      finding("CORRECT", "a"),
      finding("CONFUSING", "b"),
    ]).score;

    expect(wrong).toBeLessThan(missed);
    expect(missed).toBeLessThan(confusing);
  });

  it("renormalises over the axes a session can actually measure", () => {
    // No CORRECT and no WRONG, so accuracy is unmeasurable and its 0.5 weight
    // is redistributed rather than counted as a zero.
    const result = scoreFindings([finding("MISSED", "a"), finding("MISSED", "b")]);

    expect(result.accuracy).toBeNull();
    // completeness 0, clarity 1, over the 0.5 weight that remains -> 40.
    expect(result.score).toBe(40);
  });

  it("scores an empty set at zero rather than dividing by nothing", () => {
    const result = scoreFindings([]);

    expect(result.score).toBe(0);
    expect(result.accuracy).toBeNull();
    expect(result.completeness).toBeNull();
  });
});

describe("normalizeEvaluation: followUp", () => {
  function raw(followUp: unknown) {
    return {
      score: 60,
      depthScore: 30,
      findings: [
        { category: "WRONG", concept: "c", detail: "d", evidenceTurnIndex: 0, followUp },
      ],
    };
  }

  it("keeps a trimmed followUp", () => {
    const result = normalizeEvaluation(raw("  Revisit the Calvin cycle.  "), "s", "e");
    expect(result.findings[0].followUp).toBe("Revisit the Calvin cycle.");
  });

  it("leaves followUp unset when it is blank, missing, or not a string", () => {
    expect(normalizeEvaluation(raw("   "), "s", "e").findings[0].followUp).toBeUndefined();
    expect(normalizeEvaluation(raw(undefined), "s", "e").findings[0].followUp).toBeUndefined();
    expect(normalizeEvaluation(raw(42), "s", "e").findings[0].followUp).toBeUndefined();
  });
});

describe("normalizeEvaluation: sourceQuote", () => {
  const turns: TranscriptTurn[] = [
    {
      turnIndex: 0,
      boardText: "Chlorophyll absorbs red and blue light.\n  Green is reflected.",
      speech: "The oxygen comes from splitting water.",
      chat: [
        { sender: "learner", text: "Is chlorophyll what makes the leaf green?" },
        { sender: "user", text: "Yes, and green is the one colour it does not absorb." },
      ],
    },
  ];

  /** Build raw model output carrying a single finding with `sourceQuote`. */
  function withQuote(sourceQuote: unknown, evidenceTurnIndex: unknown = 0) {
    return {
      score: 80,
      depthScore: 40,
      findings: [
        { category: "CORRECT", concept: "chlorophyll", detail: "right", evidenceTurnIndex, sourceQuote },
      ],
    };
  }

  it("keeps a quote that appears verbatim in the turn's board text", () => {
    const result = normalizeEvaluation(
      withQuote("Chlorophyll absorbs red and blue light."),
      "s",
      "e",
      turns,
    );

    expect(result.findings[0].sourceQuote).toBe("Chlorophyll absorbs red and blue light.");
  });

  it("keeps a quote found in the turn's speech rather than its board", () => {
    const result = normalizeEvaluation(
      withQuote("comes from splitting water"),
      "s",
      "e",
      turns,
    );

    expect(result.findings[0].sourceQuote).toBe("comes from splitting water");
  });

  it("keeps a quote the user typed in the chat", () => {
    const result = normalizeEvaluation(
      withQuote("green is the one colour it does not absorb"),
      "s",
      "e",
      turns,
    );

    expect(result.findings[0].sourceQuote).toBe(
      "green is the one colour it does not absorb",
    );
  });

  it("refuses a quote taken from the student's chat line", () => {
    // The words are in the turn, but the student said them. Anchoring a
    // finding there would credit the user with the question they were asked.
    const result = normalizeEvaluation(
      withQuote("what makes the leaf green"),
      "s",
      "e",
      turns,
    );

    expect(result.findings[0].sourceQuote).toBeUndefined();
  });

  it("tolerates reflowed whitespace and returns the board's own text", () => {
    // The model flattened the newline and two spaces into one space.
    const result = normalizeEvaluation(
      withQuote("blue light. Green is reflected."),
      "s",
      "e",
      turns,
    );

    expect(result.findings[0].sourceQuote).toBe("blue light.\n  Green is reflected.");
  });

  it("drops a paraphrase but keeps the finding it belongs to", () => {
    const result = normalizeEvaluation(
      withQuote("the plant uses chlorophyll to capture light"),
      "s",
      "e",
      turns,
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe("CORRECT");
    expect(result.findings[0].sourceQuote).toBeUndefined();
  });

  it("drops a quote whose evidence turn does not exist", () => {
    const result = normalizeEvaluation(
      withQuote("Chlorophyll absorbs red and blue light.", 7),
      "s",
      "e",
      turns,
    );

    expect(result.findings[0].sourceQuote).toBeUndefined();
  });

  it("drops a quote on a MISSED finding with no evidence turn", () => {
    const result = normalizeEvaluation(
      {
        score: 50,
        depthScore: 10,
        findings: [
          {
            category: "MISSED",
            concept: "Calvin cycle",
            detail: "never mentioned",
            evidenceTurnIndex: null,
            sourceQuote: "the Calvin cycle",
          },
        ],
      },
      "s",
      "e",
      turns,
    );

    expect(result.findings[0].category).toBe("MISSED");
    expect(result.findings[0].sourceQuote).toBeUndefined();
  });

  it("drops every quote when the guard is given no turns to check against", () => {
    const result = normalizeEvaluation(
      withQuote("Chlorophyll absorbs red and blue light."),
      "s",
      "e",
    );

    expect(result.findings[0].sourceQuote).toBeUndefined();
  });
});
