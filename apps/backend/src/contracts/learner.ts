/**
 * Learner: LearnerState, Misc, LearnerResponse (Architecture Document §6.7, §6.8).
 *
 * LearnerState is the student's mental model, updated each turn. It is never
 * shared with the Evaluator as an answer key (invariant §1.4). LearnerResponse
 * is always in the student role — asking, doubting, or paraphrasing.
 */

import { z } from "zod";
import { derivedFromSchema, learnerResponseTypeSchema } from "./enums.js";

/** A single active misconception the student currently holds (§6.7). */
export const miscSchema = z.object({
  concept: z.string(),
  belief: z.string(),
});
export type Misc = z.infer<typeof miscSchema>;

/** The student's mental model, updated each turn (§6.7). */
export const learnerStateSchema = z.object({
  sessionId: z.string(),
  understoodConcepts: z.array(z.string()).default([]),
  activeMisconceptions: z.array(miscSchema).default([]),
  openGaps: z.array(z.string()).default([]),
  questionsAsked: z.array(z.string()).default([]),
  updatedAtTurn: z.number().int().default(0),
});
export type LearnerState = z.infer<typeof learnerStateSchema>;

/** The Learner's output for one turn — always in the student role (§6.8). */
export const learnerResponseSchema = z.object({
  responseId: z.string(),
  turnIndex: z.number().int(),
  type: learnerResponseTypeSchema,
  text: z.string(),
  targetConcept: z.string().nullable().optional(),
  derivedFrom: derivedFromSchema,
});
export type LearnerResponse = z.infer<typeof learnerResponseSchema>;
