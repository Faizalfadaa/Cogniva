/**
 * Planner agent — the Orchestrator's brain (Architecture Document §3.3, S5).
 *
 * Thin adapter over `runPlannerTurn`, mirroring the other agents' front doors so
 * the Orchestrator depends on a seam it can swap in tests.
 *
 * The rule that survives from the old design (§2.3): agents still never call each
 * other. The Planner only *names* the next step; the Orchestrator is the one that
 * runs Vision, ASR and the Learner.
 */

import { runPlannerTurn } from "./planner.agent.js";
import type { Plan, RunPlannerOptions, TurnSituation } from "./planner.types.js";

export { decideStep, planWithRules } from "./planner.mock.js";
export {
  feasibleSteps,
  isFeasible,
  normalizePlan,
  shouldReplan,
  takeFeasible,
} from "./planner.guard.js";
export { isTerminal, PLAN_STEP_KINDS, TERMINAL_STEPS } from "./planner.types.js";
export type {
  Plan,
  PlanSource,
  PlanStep,
  PlanStepKind,
  PlanTraceEntry,
  TurnSituation,
} from "./planner.types.js";

export class PlannerAgent {
  constructor(private readonly options: RunPlannerOptions = {}) {}

  plan(situation: TurnSituation): Promise<Plan> {
    return runPlannerTurn(situation, this.options);
  }
}
