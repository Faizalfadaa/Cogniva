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
});
export type Finding = z.infer<typeof findingSchema>;

export const evaluationResultSchema = z.object({
  evaluationId: z.string(),
  sessionId: z.string(),
  /** Overall score 0..100. */
  score: z.number().int(),
  findings: z.array(findingSchema).default([]),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  generatedAt: z.string(),
});
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
