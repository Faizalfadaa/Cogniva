/**
 * Evaluator agent — public surface (Architecture Document §3.7).
 *
 * `EvaluatorAgent` is the thin adapter the REST layer drives at session end:
 * given the projected transcript + the topic's answer key, it returns the
 * canonical EvaluationResult. A module-level singleton mirrors the orchestrator
 * so tests can force the offline path.
 */

import type { EvaluationResult } from "../../contracts/evaluation.js";
import { runEvaluator } from "./evaluator.js";
import type { EvaluatorInput } from "./types.js";

export { runEvaluator } from "./evaluator.js";
export type { RunEvaluatorOptions } from "./evaluator.js";
export * from "./types.js";

export class EvaluatorAgent {
  constructor(private readonly options: { forceMock?: boolean } = {}) {}

  evaluate(input: EvaluatorInput, evaluationId: string): Promise<EvaluationResult> {
    return runEvaluator(input, evaluationId, { useMock: this.options.forceMock });
  }
}

// --- Module-level singleton (overridable in tests) -------------------------

let current: EvaluatorAgent | null = null;

export function getEvaluator(): EvaluatorAgent {
  if (current === null) {
    current = new EvaluatorAgent();
  }
  return current;
}

/** Override the singleton (used by tests to force the offline fallback). */
export function setEvaluator(evaluator: EvaluatorAgent | null): void {
  current = evaluator;
}
