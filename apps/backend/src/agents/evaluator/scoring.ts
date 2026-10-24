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
 * The four axes below are the same ones the debrief screen plots, so the
 * headline is literally their weighted average and the two cannot disagree.
 * Depth is counted differently from the other three: how deeply something was
 * explained cannot be read off a list of categories, so it stays a model
 * judgement (with its own rubric in the prompt). It used to be left out of this
 * number, which let a debrief read 100 overall above a depth of 40 and left
 * users unable to see where the 100 came from.
 */

import type { Finding } from "../../contracts/evaluation.js";

/**
 * How much each axis is worth.
 *
 * Accuracy leads because teaching something wrong is the costliest outcome:
 * the student leaves believing it. Completeness is next — a gap is a lesser
 * failure than an error, because nothing false was planted. Depth rewards
 * explaining how something works rather than naming it. Clarity is real but
 * lightest: a muddled explanation of a correct idea is recoverable by asking
 * one more question, which is exactly what the student does.
 */
export const SCORE_WEIGHTS = {
  accuracy: 0.4,
  completeness: 0.25,
  clarity: 0.15,
  depth: 0.2,
} as const;

/** Each CONFUSING finding costs this much clarity. Five of them reach zero. */
export const CONFUSION_PENALTY = 0.2;

export interface ScoreBreakdown {
  /** 0..1 each, or null when this session gives nothing to measure. */
  accuracy: number | null;
  completeness: number | null;
  clarity: number | null;
  /** 0..1, the Evaluator's own judgement; null when none was given. */
  depth: number | null;
  /** The weighted result, 0..100. */
  score: number;
}

/**
 * Score a set of findings, plus the Evaluator's depth judgement (0..100).
 *
 * An axis with nothing to measure is dropped and the remaining weights are
 * renormalised, rather than counted as zero. A session with no CORRECT and no
 * WRONG finding has no accuracy to report, and folding that in as a zero would
 * punish a short session for being short instead of for being wrong.
 */
export function scoreFindings(findings: Finding[], depthScore?: number): ScoreBreakdown {
  const correct = findings.filter((f) => f.category === "CORRECT").length;
  const wrong = findings.filter((f) => f.category === "WRONG").length;
  const missed = findings.filter((f) => f.category === "MISSED").length;
  const confusing = findings.filter((f) => f.category === "CONFUSING").length;

  const judged = correct + wrong;
  const total = findings.length;

  const accuracy = judged === 0 ? null : correct / judged;
  const completeness = total === 0 ? null : (total - missed) / total;
  const clarity = total === 0 ? null : Math.max(0, 1 - confusing * CONFUSION_PENALTY);
  const depth =
    depthScore === undefined || !Number.isFinite(depthScore)
      ? null
      : Math.max(0, Math.min(100, depthScore)) / 100;

  // A session with no findings at all has nothing to score, depth included.
  if (total === 0) return { accuracy, completeness, clarity, depth, score: 0 };

  const parts: Array<[number | null, number]> = [
    [accuracy, SCORE_WEIGHTS.accuracy],
    [completeness, SCORE_WEIGHTS.completeness],
    [clarity, SCORE_WEIGHTS.clarity],
    [depth, SCORE_WEIGHTS.depth],
  ];

  let weighted = 0;
  let weightUsed = 0;
  for (const [value, weight] of parts) {
    if (value === null) continue;
    weighted += value * weight;
    weightUsed += weight;
  }

  // toFixed first: 0.15 / 0.4 lands on 0.37499999..., which would round a
  // plain 37.5 down.
  const score = weightUsed === 0 ? 0 : Math.round(Number(((weighted / weightUsed) * 100).toFixed(6)));

  return { accuracy, completeness, clarity, depth, score };
}
