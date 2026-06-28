import * as config from "../../config/index.js";
import type { AsrAgentInput, AsrLLMOutput } from "./asr.types.js";

/**
 * Mock deterministik -- dipakai test dan demo offline (tanpa API key, tanpa
 * jaringan), sama perannya dengan mockVisionAI/mockLearnerAI. TIDAK
 * mentranskripsi audio sungguhan; hanya menghasilkan bentuk valid agar pipeline
 * (guard, pemetaan kontrak, orchestrator) bisa diuji tanpa memanggil model.
 */
export function mockAsrAI(input: AsrAgentInput): AsrLLMOutput {
  if (!input.audioBase64) {
    return {
      transcript: "",
      confidence: 0,
      language: config.ASR_DEFAULT_LANGUAGE,
      ambiguities: ["tidak ada audio untuk ditranskripsi (mock)"],
    };
  }

  return {
    transcript: `(mock) penjelasan lisan tentang ${input.topic}`,
    confidence: 1,
    language: config.ASR_DEFAULT_LANGUAGE,
    ambiguities: [],
  };
}
