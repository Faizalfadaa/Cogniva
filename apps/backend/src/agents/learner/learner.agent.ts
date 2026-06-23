import {
  LearnerAgentInput,
  LearnerAgentOutput,
  LearnerLLMOutput
} from "./learner.types";
import {
  buildLearnerMessages,
  LEARNER_LLM_OUTPUT_SCHEMA
} from "../../llm/prompts/learner.prompt";
import {
  createFallbackOutput,
  normalizeLearnerOutput
} from "./learner.guard";
import { mockLearnerAI } from "./learner.mock";
import { LLMClient } from "../../llm/index.js";
import * as config from "../../config/index.js";

export type RunLearnerOptions = {
  /** Force the deterministic mock (used by tests and offline demos). */
  useMock?: boolean;
};

export async function runLearnerTurn(
  input: LearnerAgentInput,
  options: RunLearnerOptions = {}
): Promise<LearnerAgentOutput> {
  try {
    // Use the mock when explicitly forced, when USE_MOCK_AI is set, or when no
    // Gemini credential is configured — so the loop runs fully offline.
    const useMockAI =
      options.useMock === true ||
      process.env.USE_MOCK_AI === "true" ||
      !config.llmAvailable();

    const rawOutput: LearnerLLMOutput = useMockAI
      ? mockLearnerAI(input)
      : await callRealAI(input);

    return normalizeLearnerOutput(rawOutput, input);
  } catch (error) {
    console.error("[LearnerAgent] Failed to run turn:", error);
    return createFallbackOutput(input);
  }
}

/** Real LLM path — routed through the project's centralized Gemini wrapper. */
async function callRealAI(
  input: LearnerAgentInput
): Promise<LearnerLLMOutput> {
  const messages = buildLearnerMessages(input);
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  const llm = new LLMClient({
    model: config.LEARNER_MODEL,
    maxTokens: config.LLM_MAX_TOKENS,
    timeout: config.LLM_TIMEOUT,
    thinkingBudget: config.LLM_THINKING_BUDGET
  });
  const data = await llm.structured({
    system,
    user,
    schema: LEARNER_LLM_OUTPUT_SCHEMA
  });
  return data as unknown as LearnerLLMOutput;
}
