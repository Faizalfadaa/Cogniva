import type { VisionAgentInput, VisionLLMOutput } from "./vision.types.js";

/**
 * Deterministic mock -- used by tests and offline demos (no API key, no
 * network), same role as mockLearnerAI. It does NOT read a real image; it only
 * produces a valid shape so the pipeline (guard, contract mapping, orchestrator)
 * can be exercised without calling the real model.
 */
export function mockVisionAI(input: VisionAgentInput): VisionLLMOutput {
  if (!input.imageBase64) {
    return {
      transcript: "",
      elements: [],
      overallConfidence: 0,
      ambiguities: ["no image to read (mock)"],
      needsConfirmation: true,
      confirmationPrompt: "No board image yet. Could you write or type something first?",
    };
  }

  return {
    transcript: `(mock) board about ${input.topic}`,
    elements: [
      {
        kind: "text",
        content: `(mock) ${input.topic}`,
        confidence: 1,
        location: "center",
      },
    ],
    overallConfidence: 1,
    ambiguities: [],
    needsConfirmation: false,
  };
}
