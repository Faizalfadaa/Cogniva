/**
 * Planner agent — one cheap model call that schedules the turn (§3.3, S5).
 *
 * The other agents do the work; this one decides what work is worth doing. It
 * runs at most once per turn (twice when a result surprises it and the
 * Orchestrator re-plans), which is what keeps a dynamic pipeline from costing
 * more than the fixed one it replaces.
 *
 * Offline behavior matches every other agent: no credential, USE_MOCK_AI, or a
 * failed call all land on the deterministic rule engine rather than an error.
 */

import * as config from "../../config/index.js";
import { LLMClient } from "../../llm/index.js";
import { buildPlannerMessages, PLANNER_LLM_OUTPUT_SCHEMA } from "../../llm/prompts/planner.prompt.js";
import { normalizePlan } from "./planner.guard.js";
import { planWithRules } from "./planner.mock.js";
import type { Plan, PlannerLLMOutput, RunPlannerOptions, TurnSituation } from "./planner.types.js";

/** Plan (or re-plan) the remaining steps of one teaching turn. Never throws. */
export async function runPlannerTurn(
  situation: TurnSituation,
  options: RunPlannerOptions = {},
): Promise<Plan> {
  const useRules =
    options.useMock === true ||
    config.PLANNER_MODE === "rules" ||
    process.env.USE_MOCK_AI === "true" ||
    !config.llmAvailable();

  if (useRules) return planWithRules(situation);

  try {
    return normalizePlan(await callRealAI(situation), situation);
  } catch (error) {
    console.error("[PlannerAgent] Failed to plan turn:", error);
    return planWithRules(situation);
  }
}

/** Real LLM path — routed through the project's centralized Gemini wrapper. */
async function callRealAI(situation: TurnSituation): Promise<PlannerLLMOutput> {
  const messages = buildPlannerMessages(situation);
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  const llm = new LLMClient({
    model: config.PLANNER_MODEL,
    maxTokens: config.PLANNER_MAX_TOKENS,
    timeout: config.LLM_TIMEOUT,
    thinkingBudget: config.LLM_THINKING_BUDGET,
  });
  const data = await llm.structured({ system, user, schema: PLANNER_LLM_OUTPUT_SCHEMA });
  return data as unknown as PlannerLLMOutput;
}
