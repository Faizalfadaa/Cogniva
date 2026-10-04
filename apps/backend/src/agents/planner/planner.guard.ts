/**
 * Planner guard — nothing the model proposes reaches the Orchestrator unchecked.
 *
 * A plan is a schedule of real work (extra Vision calls, extra ASR calls), so a
 * malformed one is not just ugly, it is expensive or non-terminating. Three
 * rules keep it safe: unknown step names are dropped, a step whose precondition
 * is not met is skipped rather than attempted, and a plan that never terminates
 * gets a terminal step appended by the rule engine.
 */

import * as config from "../../config/index.js";
import { decideStep, planWithRules } from "./planner.mock.js";
import {
  isTerminal,
  PLAN_STEP_KINDS,
  type Plan,
  type PlannerLLMOutput,
  type PlanStep,
  type PlanStepKind,
  type TurnSituation,
} from "./planner.types.js";

/** Can this step run right now? Also what stops a plan from looping. */
export function isFeasible(kind: PlanStepKind, situation: TurnSituation): boolean {
  const done = (k: PlanStepKind): boolean => situation.completed.includes(k);
  switch (kind) {
    case "read_board":
      return !situation.boardRead;
    case "reuse_board":
      return !situation.boardRead && situation.hasPreviousBoard;
    case "verify_board":
      // A directed re-read needs both an image to look at and a first reading
      // to improve on, and is worth doing only once per turn.
      return situation.boardRead && situation.hasImage && !done("verify_board");
    case "transcribe_audio":
      // `completed` matters as well as `audioTranscribed`: a caller with no ASR
      // wired up produces no transcript, and without this the step would look
      // pending forever and eat the whole budget.
      return situation.hasAudio && !situation.audioTranscribed && !done("transcribe_audio");
    case "ask_learner":
      // The student needs something to react to — and must never be handed a
      // reading the user could still correct. Without this, an optimistic plan
      // ("read the board, then ask the student") would sail past a verification
      // that came back just as unsure.
      return (
        situation.boardRead &&
        !(situation.boardNeedsConfirmation && situation.allowConfirmation)
      );
    case "ask_confirmation":
      return situation.allowConfirmation && situation.boardRead && situation.boardNeedsConfirmation;
    default:
      return false;
  }
}

/** All steps that could run right now, in declaration order. Surfaced to the prompt. */
export function feasibleSteps(situation: TurnSituation): PlanStepKind[] {
  return PLAN_STEP_KINDS.filter((kind) => isFeasible(kind, situation));
}

/**
 * Pop the first step of `remaining` that still fits the situation, discarding the
 * ones that reality has already made pointless (e.g. a planned `transcribe_audio`
 * after ASR already ran). `step` is null when nothing in the plan applies — the
 * Orchestrator then re-plans or falls back to the rule engine.
 */
export function takeFeasible(
  remaining: PlanStep[],
  situation: TurnSituation,
): { step: PlanStep | null; rest: PlanStep[] } {
  for (let i = 0; i < remaining.length; i++) {
    if (isFeasible(remaining[i].kind, situation)) {
      return { step: remaining[i], rest: remaining.slice(i + 1) };
    }
  }
  return { step: null, rest: [] };
}

/**
 * True when the turn has gone somewhere the plan did not anticipate and it is
 * worth asking for a new one: the board came back unsure, yet the plan's next
 * move neither re-reads it nor asks the user about it.
 */
export function shouldReplan(situation: TurnSituation, remaining: PlanStep[]): boolean {
  if (!situation.boardRead || !situation.boardNeedsConfirmation) return false;
  if (situation.completed.includes("verify_board")) return false;

  const next = takeFeasible(remaining, situation).step;
  return next === null || (next.kind !== "verify_board" && next.kind !== "ask_confirmation");
}

/** Normalize raw model output into a plan that is safe to execute. */
export function normalizePlan(raw: PlannerLLMOutput, situation: TurnSituation): Plan {
  const steps: PlanStep[] = [];

  for (const entry of Array.isArray(raw.steps) ? raw.steps : []) {
    const kind = asStepKind(entry?.kind);
    if (!kind) continue; // unknown step name -> drop it
    if (steps.some((s) => s.kind === kind)) continue; // each step runs at most once
    steps.push({
      kind,
      reason: text(entry?.reason) || "planner did not say why",
      ...(text(entry?.focus) ? { focus: text(entry.focus) } : {}),
    });
    if (isTerminal(kind)) break; // anything after a terminal step is unreachable
  }

  const bounded = steps.slice(0, config.PLANNER_MAX_STEPS);
  if (bounded.length === 0) return planWithRules(situation);

  // A plan that never ends would burn the whole budget on preparation, so the
  // rule engine supplies the ending the model forgot.
  if (!bounded.some((s) => isTerminal(s.kind))) {
    bounded.push(terminalFor(situation, bounded));
  }

  return {
    steps: bounded,
    source: "llm",
    rationale: text(raw.rationale) || "no rationale given",
  };
}

/**
 * The terminal step to append: what the rule engine would do once the planned
 * preparation is out of the way.
 */
function terminalFor(situation: TurnSituation, planned: PlanStep[]): PlanStep {
  const projected: TurnSituation = {
    ...situation,
    completed: [...situation.completed, ...planned.map((s) => s.kind)],
    boardRead: situation.boardRead || planned.some((s) => s.kind === "read_board" || s.kind === "reuse_board"),
    audioTranscribed: situation.audioTranscribed || planned.some((s) => s.kind === "transcribe_audio"),
  };
  const chosen = decideStep(projected);
  return isTerminal(chosen.kind)
    ? chosen
    : { kind: "ask_learner", reason: "step budget spent — hand the turn to the student" };
}

function asStepKind(value: unknown): PlanStepKind | null {
  const name = text(value).toLowerCase();
  return (PLAN_STEP_KINDS as readonly string[]).includes(name) ? (name as PlanStepKind) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
