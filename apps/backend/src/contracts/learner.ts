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

/**
 * How often the student has already asked about one core concept. Two is the
 * limit, after which it accepts the explanation and asks to move on
 * (agents/learner/learner.repeat.ts). Optional: states persisted before the
 * limit existed carry no tally.
 */
export const askedConceptSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().int(),
  /**
   * "probe" (the default) counts plain questions about the concept; "extend"
   * counts questions that apply it to a new case, which get their own budget.
   */
  kind: z.enum(["probe", "extend"]).optional(),
});
export type AskedConcept = z.infer<typeof askedConceptSchema>;

/** The student's mental model, updated each turn (§6.7). */
export const learnerStateSchema = z.object({
  sessionId: z.string(),
  understoodConcepts: z.array(z.string()).default([]),
  activeMisconceptions: z.array(miscSchema).default([]),
  openGaps: z.array(z.string()).default([]),
  questionsAsked: z.array(z.string()).default([]),
  askedConcepts: z.array(askedConceptSchema).optional(),
  /**
   * Questions in a row that asked how the teacher's own previous answer works
   * (agents/learner/learner.depth.ts). Optional: older states carry none.
   */
  followUpDepth: z.number().int().optional(),
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
