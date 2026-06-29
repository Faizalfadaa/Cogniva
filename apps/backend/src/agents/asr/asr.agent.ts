import { buildAsrMessages, ASR_LLM_OUTPUT_SCHEMA } from "../../llm/prompts/asr.prompt.js";
import { LLMClient } from "../../llm/index.js";
import * as config from "../../config/index.js";
import {
  createFallbackTranscript,
  normalizeAsrLLMOutput,
  toSpeechTranscript,
} from "./asr.guard.js";
import { mockAsrAI } from "./asr.mock.js";
import type {
  AsrAgentInput,
  AsrLLMOutput,
  RunAsrOptions,
  SpeechTranscript,
} from "./asr.types.js";

/**
 * Jalankan satu transkripsi suara. Dipanggil oleh AsrAgent (agents/asr/index.ts)
 * hanya ketika ada audio untuk ditranskripsi -- jalur typedText tetap memakai
 * jalan pintas tanpa model di AsrAgent.
 */
export async function runAsrTurn(
  input: AsrAgentInput,
  options: RunAsrOptions = {},
): Promise<SpeechTranscript> {
  try {
    const useMockAI =
      options.useMock === true ||
      process.env.USE_MOCK_AI === "true" ||
      !config.llmAvailable();

    const rawOutput: AsrLLMOutput = useMockAI
      ? mockAsrAI(input)
      : normalizeAsrLLMOutput(await callRealAI(input));

    return toSpeechTranscript(rawOutput, input);
  } catch (error) {
    console.error("[AsrAgent] Failed to run turn:", error);
    return createFallbackTranscript(input);
  }
}

/**
 * Jalur LLM nyata -- lewat pembungkus Gemini terpusat proyek (§7.3), memakai
 * field `audio` di StructuredArgs (pola aditif sama dengan `image` milik Vision;
 * lihat GAPS_ASR.md). gemini-2.5-flash menerima audio inline langsung.
 */
async function callRealAI(input: AsrAgentInput): Promise<Record<string, unknown>> {
  const messages = buildAsrMessages(input);
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  const llm = new LLMClient({
    model: config.ASR_MODEL,
    maxTokens: config.LLM_MAX_TOKENS,
    timeout: config.LLM_TIMEOUT,
    thinkingBudget: config.LLM_THINKING_BUDGET,
  });

  return llm.structured({
    system,
    user,
    schema: ASR_LLM_OUTPUT_SCHEMA,
    audio: { data: input.audioBase64, mimeType: input.mimeType },
  });
}
