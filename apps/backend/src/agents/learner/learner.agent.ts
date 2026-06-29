import {
  AgentObservation,
  LearnerAction,
  LearnerAgentInput,
  LearnerAgentOutput,
  LearnerLLMOutput,
  LearnerTools
} from "./learner.types";
import {
  buildLearnerMessages,
  LEARNER_LLM_OUTPUT_SCHEMA
} from "../../llm/prompts/learner.prompt";
import {
  createFallbackOutput,
  normalizeAction,
  normalizeLearnerOutput
} from "./learner.guard";
import { mockLearnerAI } from "./learner.mock";
import { LLMClient } from "../../llm/index.js";
import * as config from "../../config/index.js";

export type RunLearnerOptions = {
  /** Force the deterministic mock (used by tests and offline demos). */
  useMock?: boolean;
  /**
   * Tools the orchestrator injects so the student can investigate before asking
   * (§2.3). Absent -> the student responds in a single step (original behavior).
   */
  tools?: LearnerTools;
};

/** Max tool uses per turn — bounds latency/cost; the student then must respond. */
const MAX_TOOL_STEPS = 2;

/**
 * Run one Learner turn as an agent loop (§3.6): the student has a goal — understand
 * the explanation and surface its own gaps — and each step it either uses a tool to
 * investigate (re-read the board, recall an earlier turn) or commits to a student
 * response. With no tools injected this collapses to the original single call.
 */
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

    const tools = options.tools;
    const availableTools = toolNames(tools);
    const observations: AgentObservation[] = [];

    let raw: LearnerLLMOutput | undefined;
    for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
      const turnInput: LearnerAgentInput = { ...input, availableTools, observations };
      raw = useMockAI ? mockLearnerAI(turnInput) : await callRealAI(turnInput);

      const action = normalizeAction(raw.action);
      // Terminal response, no tools to use, or budget spent -> finalize.
      if (
        action.kind === "respond" ||
        availableTools.length === 0 ||
        step === MAX_TOOL_STEPS
      ) {
        break;
      }
      const observed = await runTool(tools, action, observations);
      if (!observed) break; // tool unavailable or already used -> respond now
      observations.push(observed);
    }

    return normalizeLearnerOutput(raw as LearnerLLMOutput, input);
  } catch (error) {
    console.error("[LearnerAgent] Failed to run turn:", error);
    return createFallbackOutput(input);
  }
}

/** Names of the tools actually available this turn, surfaced to the prompt. */
function toolNames(tools?: LearnerTools): string[] {
  if (!tools) return [];
  const names: string[] = [];
  if (tools.rereadBoard) names.push("reread_board");
  if (tools.recallEarlier) names.push("recall_earlier");
  return names;
}

/** Execute the tool the student chose; null if unavailable or already used. */
async function runTool(
  tools: LearnerTools | undefined,
  action: LearnerAction,
  observations: AgentObservation[]
): Promise<AgentObservation | null> {
  if (!tools) return null;
  const detail = (action.focus ?? action.query ?? "").trim();
  // Never repeat the same tool+argument within a single turn.
  if (observations.some((o) => o.kind === action.kind && o.detail === detail)) {
    return null;
  }
  try {
    if (action.kind === "reread_board" && tools.rereadBoard) {
      const result = await tools.rereadBoard(detail || "bagian yang belum jelas");
      console.error(`[Learner] tool reread_board("${detail}")`);
      return { kind: action.kind, detail, result };
    }
    if (action.kind === "recall_earlier" && tools.recallEarlier) {
      const result = await tools.recallEarlier(detail || "penjelasan sebelumnya");
      console.error(`[Learner] tool recall_earlier("${detail}")`);
      return { kind: action.kind, detail, result };
    }
  } catch (err) {
    console.error("[Learner] tool failed:", err);
  }
  return null;
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
