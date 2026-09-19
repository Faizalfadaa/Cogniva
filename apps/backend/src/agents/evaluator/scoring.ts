/**
 * The overall score, computed from the findings rather than asked of the model.
 *
 * It used to be a number the model returned directly, under a one-line
 * instruction ("an integer 0..100 reflecting the overall quality") with no
 * rubric, no weights, and no stated relationship to the findings it had just
 * written. Two consequences followed. The same transcript could score
 * differently on two runs, and the headline number did not have to agree with
 * the per-axis breakdown the debrief screen draws underneath it: a session
 * whose axes read 100/100/80 could still be handed a 75.
 *
 * So the split is now along the line each side is actually good at. The model
 * judges *what happened* — which concept was right, wrong, missed or muddled,
 * and which words in the transcript prove it. The arithmetic on top of those
 * judgements happens here, where it is auditable, reproducible, and explainable
 * to the user in one sentence.
 *
 * The three axes below are the same ones the debrief screen already plots, so
 * the headline is now literally their weighted average and the two can no
 * longer disagree. Depth is the deliberate exception: how deeply something was
 * explained cannot be counted from a list of categories, so it stays a model
 * judgement (with its own rubric in the prompt) and stays out of this number.
 */

import type { Finding } from "../../contracts/evaluation.js";

/**
 * How much each axis is worth.
 *
 * Accuracy leads because teaching something wrong is the costliest outcome:
 * the student leaves believing it. Completeness is next — a gap is a lesser
 * failure than an error, because nothing false was planted. Clarity is real
 * but lightest: a muddled explanation of a correct idea is recoverable by
 * asking one more question, which is exactly what the student does.
 */
export const SCORE_WEIGHTS = {
  accuracy: 0.5,
  completeness: 0.3,
  clarity: 0.2,
} as const;

/** Each CONFUSING finding costs this much clarity. Five of them reach zero. */
export const CONFUSION_PENALTY = 0.2;

export interface ScoreBreakdown {
  /** 0..1 each, or null when this session gives nothing to measure. */
  accuracy: number | null;
  completeness: number | null;
  clarity: number | null;
  /** The weighted result, 0..100. */
  score: number;
}

/**
 * Score a set of findings.
 *
 * An axis with nothing to measure is dropped and the remaining weights are
 * renormalised, rather than counted as zero. A session with no CORRECT and no
 * WRONG finding has no accuracy to report, and folding that in as a zero would
 * punish a short session for being short instead of for being wrong.
 */
export function scoreFindings(findings: Finding[]): ScoreBreakdown {
  const correct = findings.filter((f) => f.category === "CORRECT").length;
  const wrong = findings.filter((f) => f.category === "WRONG").length;
  const missed = findings.filter((f) => f.category === "MISSED").length;
  const confusing = findings.filter((f) => f.category === "CONFUSING").length;

  const judged = correct + wrong;
  const total = findings.length;

  const accuracy = judged === 0 ? null : correct / judged;
  const completeness = total === 0 ? null : (total - missed) / total;
  const clarity = total === 0 ? null : Math.max(0, 1 - confusing * CONFUSION_PENALTY);

  const parts: Array<[number | null, number]> = [
    [accuracy, SCORE_WEIGHTS.accuracy],
    [completeness, SCORE_WEIGHTS.completeness],
    [clarity, SCORE_WEIGHTS.clarity],
  ];

  let weighted = 0;
  let weightUsed = 0;
  for (const [value, weight] of parts) {
    if (value === null) continue;
    weighted += value * weight;
    weightUsed += weight;
  }

  // Nothing measurable at all: an empty evaluation scores zero, which is what
  // the failure path already produced before this existed.
  const score = weightUsed === 0 ? 0 : Math.round((weighted / weightUsed) * 100);

  return { accuracy, completeness, clarity, score };
}
