import { describe, it, expect, vi, beforeEach } from "vitest";
import { runEvaluator } from "../evaluator";
import * as geminiClientModule from "../geminiClient";
import { EvaluatorInput } from "../types";

vi.mock("../geminiClient", () => ({
  createGeminiClient: vi.fn(),
}));

describe("runEvaluator", () => {
  const mockInput: EvaluatorInput = {
    sessionId: "sess-1",
    turns: [
      {
        turnIndex: 0,
        sessionId: "sess-1",
        interpretation: { transcribedText: "Photosynthesis makes food.", elements: [] },
        typedInput: "Photosynthesis makes food.",
        learnerResponseId: "r-1",
        createdAt: "2026-06-25T00:00:00Z",
      },
    ],
    referenceMaterial: "Plants make food using sunlight.",
    keyConcepts: ["Sunlight", "Water", "Carbon Dioxide"],
    commonMisconceptions: ["Plants eat dirt."],
  };

  const validMockResponse = JSON.stringify({
    score: 85,
    summary: "Good start.",
    strengths: ["Clear explanation"],
    improvements: ["Mention sunlight"],
    findings: [
      {
        category: "TERLEWAT",
        concept: "Sunlight",
        detail: "Did not mention sunlight.",
        evidenceTurnIndex: 0,
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully evaluates and parses the response", async () => {
    const mockGenerate = vi.fn().mockResolvedValue(validMockResponse);
    vi.mocked(geminiClientModule.createGeminiClient).mockReturnValue({
      generate: mockGenerate,
    });

    const result = await runEvaluator(mockInput, "fake-api-key");

    expect(result.sessionId).toBe("sess-1");
    expect(result.evaluationId).toMatch(/^ev_[a-f0-9]{8}$/);
    expect(result.score).toBe(85);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe("TERLEWAT");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("retries on invalid JSON and eventually throws", async () => {
    const mockGenerate = vi.fn().mockResolvedValue("invalid json");
    vi.mocked(geminiClientModule.createGeminiClient).mockReturnValue({
      generate: mockGenerate,
    });

    await expect(runEvaluator(mockInput, "fake-api-key", 2)).rejects.toThrow(
      /Evaluator failed after 2 retries/
    );

    // 1 initial attempt + 2 retries = 3 calls
    expect(mockGenerate).toHaveBeenCalledTimes(3);
  });
});
