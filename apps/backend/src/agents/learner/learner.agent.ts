import "dotenv/config";

import {
  LearnerAgentInput,
  LearnerAgentOutput,
  LearnerLLMOutput
} from "./learner.types";
import { buildLearnerMessages } from "../../llm/prompts/learner.prompt";
import {
  createFallbackOutput,
  normalizeLearnerOutput
} from "./learner.guard";
import { callAIJson } from "../../llm/providers/aiClient";
import { mockLearnerAI } from "./learner.mock";

export async function runLearnerTurn(
  input: LearnerAgentInput
): Promise<LearnerAgentOutput> {
  try {
    const useMockAI = process.env.USE_MOCK_AI === "true";

    const rawOutput: LearnerLLMOutput = useMockAI
      ? mockLearnerAI(input)
      : await callRealAI(input);

    return normalizeLearnerOutput(rawOutput, input);
  } catch (error) {
    console.error("[LearnerAgent] Failed to run turn:", error);
    return createFallbackOutput(input);
  }
}

async function callRealAI(
  input: LearnerAgentInput
): Promise<LearnerLLMOutput> {
  const messages = buildLearnerMessages(input);
  return await callAIJson<LearnerLLMOutput>(messages);
}
