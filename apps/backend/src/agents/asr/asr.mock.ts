import * as config from "../../config/index.js";
import type { AsrAgentInput, AsrLLMOutput } from "./asr.types.js";

/**
 * Deterministic mock -- used by tests and offline demos (no API key, no
 * network), same role as mockVisionAI/mockLearnerAI. It does NOT transcribe real
 * audio; it only produces a valid shape so the pipeline (guard, contract
 * mapping, orchestrator) can be exercised without calling the model.
 */
export function mockAsrAI(input: AsrAgentInput): AsrLLMOutput {
  if (!input.audioBase64) {
    return {
      transcript: "",
      confidence: 0,
      language: config.ASR_DEFAULT_LANGUAGE,
      ambiguities: ["no audio to transcribe (mock)"],
    };
  }

  return {
    transcript: `(mock) spoken explanation about ${input.topic}`,
    confidence: 1,
    language: config.ASR_DEFAULT_LANGUAGE,
    ambiguities: [],
  };
}
