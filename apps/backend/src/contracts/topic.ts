/**
 * Topic — a topic definition with its source of truth (Architecture Document §6.1).
 *
 * Curated up front for demo topics. referenceMaterial flows in full to the
 * Evaluator as the answer key; only commonMisconceptions flow to the Learner
 * (invariant: the Learner never holds the answer key, §1.4).
 */

import { z } from "zod";
import { difficultySchema } from "./enums.js";

export const topicSchema = z.object({
  topicId: z.string(),
  title: z.string(),
  description: z.string(),
  /** Reference material (markdown) as the source of truth. */
  referenceMaterial: z.string(),
  /** Key concepts the user should ideally convey. */
  keyConcepts: z.array(z.string()).default([]),
  /** Common misconceptions; seeds for the Learner's faulty beliefs. */
  commonMisconceptions: z.array(z.string()).default([]),
  difficulty: difficultySchema,
});

export type Topic = z.infer<typeof topicSchema>;
