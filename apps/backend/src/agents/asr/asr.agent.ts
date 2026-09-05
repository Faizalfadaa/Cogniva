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
 * Run one speech transcription. Called by AsrAgent (agents/asr/index.ts) only
 * when there's audio to transcribe -- the typedText path still uses the
 * no-model shortcut inside AsrAgent.
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
      : normalizeAsrLLMOutput(await callRealAI(input, options));

    return toSpeechTranscript(rawOutput, input);
  } catch (error) {
    console.error("[AsrAgent] Failed to run turn:", error);
    return createFallbackTranscript(input);
  }
}

/**
 * Real LLM path -- through the project's centralized Gemini wrapper (§7.3), using
 * the `audio` field in StructuredArgs (same additive pattern as Vision's `image`;
 * see GAPS_ASR.md). gemini-2.5-flash accepts inline audio directly.
 */
async function callRealAI(
  input: AsrAgentInput,
  options: RunAsrOptions,
): Promise<Record<string, unknown>> {
  const messages = buildAsrMessages(input);
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  const llm = new LLMClient({
    model: config.ASR_MODEL,
    maxTokens: config.LLM_MAX_TOKENS,
    timeout: config.LLM_TIMEOUT,
    thinkingBudget: config.LLM_THINKING_BUDGET,
  });

  const data = await llm.structured({
    system,
    user,
    schema: ASR_LLM_OUTPUT_SCHEMA,
    audio: { data: input.audioBase64, mimeType: input.mimeType },
  });

  if (options.onUsage && llm.lastUsage) options.onUsage(llm.lastUsage);
  return data;
}
