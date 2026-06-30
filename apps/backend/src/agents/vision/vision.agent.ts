import { buildVisionMessages, VISION_LLM_OUTPUT_SCHEMA } from "../../llm/prompts/vision.prompt.js";
import { LLMClient } from "../../llm/index.js";
import * as config from "../../config/index.js";
import {
  createFallbackInterpretation,
  normalizeVisionLLMOutput,
  toVisionInterpretation,
} from "./vision.guard.js";
import { mockVisionAI } from "./vision.mock.js";
import type {
  RunVisionOptions,
  VisionAgentInput,
  VisionInterpretation,
  VisionLLMOutput,
} from "./vision.types.js";

/**
 * Run one board reading. Called by VisionAgent (agents/vision/index.ts) only
 * when there's an image to read -- the typedText path still uses the no-model
 * shortcut inside VisionAgent, matching the existing M1 stub.
 */
export async function runVisionTurn(
  input: VisionAgentInput,
  options: RunVisionOptions = {},
): Promise<VisionInterpretation> {
  try {
    const useMockAI =
      options.useMock === true ||
      process.env.USE_MOCK_AI === "true" ||
      !config.llmAvailable();

    const rawOutput: VisionLLMOutput = useMockAI
      ? mockVisionAI(input)
      : normalizeVisionLLMOutput(await callRealAI(input));

    return toVisionInterpretation(
      rawOutput,
      input.snapshotId,
      config.VISION_CONFIDENCE_THRESHOLD,
    );
  } catch (error) {
    console.error("[VisionAgent] Failed to run turn:", error);
    return createFallbackInterpretation(input.snapshotId);
  }
}

/**
 * Real LLM path -- through the project's centralized Gemini wrapper (§7.3).
 *
 * INTEGRATION NOTE: this needs StructuredArgs.image, a field that does NOT yet
 * exist in llm/providers/gemini.ts (that wrapper currently only handles text,
 * used by the Learner). See GAPS_VISION.md for the minimal proposed diff so the
 * wrapper can accept an image without changing how the Learner uses it.
 */
async function callRealAI(input: VisionAgentInput): Promise<Record<string, unknown>> {
  const messages = buildVisionMessages(input);
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  const llm = new LLMClient({
    model: config.VISION_MODEL,
    maxTokens: config.VISION_MAX_TOKENS,
    timeout: config.LLM_TIMEOUT,
    thinkingBudget: config.LLM_THINKING_BUDGET,
  });

  return llm.structured({
    system,
    user,
    schema: VISION_LLM_OUTPUT_SCHEMA,
    image: { data: input.imageBase64, mimeType: input.mimeType },
  });
}
