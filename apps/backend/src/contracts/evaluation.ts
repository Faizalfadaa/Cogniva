/**
 * EvaluationResult & Finding — the Evaluator's output at session end (§6.9).
 *
 * Rendered by the debrief screen. The Evaluator runs once, post-session, and
 * receives the full transcript + the topic's referenceMaterial (§3.7).
 */

import { z } from "zod";
import { findingCategorySchema } from "./enums.js";

/** A single categorized finding (§6.9). */
export const findingSchema = z.object({
  category: findingCategorySchema,
  concept: z.string(),
  detail: z.string(),
  evidenceTurnIndex: z.number().int().nullable().optional(),
  /**
   * The exact words in the evidence turn this finding rests on, so the debrief
   * can highlight one sentence instead of the whole turn.
   *
   * Optional in both directions: a MISSED concept has no turn to quote, and the
   * guard drops a quote it cannot locate in the turn rather than handing the UI
   * a string to search for that isn't there.
   */
  sourceQuote: z.string().optional(),
  /**
   * One concrete thing to do about this finding next time.
   *
   * Absent on a CORRECT finding: there is nothing to fix, and inventing advice
   * for something already explained well would only dilute the advice that
   * matters.
   */
  followUp: z.string().optional(),
});
export type Finding = z.infer<typeof findingSchema>;

export const evaluationResultSchema = z.object({
  evaluationId: z.string(),
  sessionId: z.string(),
  /** Overall score 0..100. */
  score: z.number().int(),
  /**
   * How deeply the user explained the mechanism, 0..100, judged once across the
   * whole session and deliberately separate from `score`.
   *
   * `score` asks whether the explanation was right; this asks whether it went
   * past naming things. "Photosynthesis turns light into energy" is correct and
   * shallow: it scores well on `score` and poorly here.
   */
  depthScore: z.number().int().min(0).max(100),
  findings: z.array(findingSchema).default([]),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  generatedAt: z.string(),
});
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
