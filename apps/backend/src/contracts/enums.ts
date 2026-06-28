/**
 * Controlled enumerations used across the contracts (Architecture Document §4, §6).
 *
 * Enum values are anglicized for an international audience. Mapping back to the
 * Indonesian architecture PDF (agreed contract change):
 *
 *   SessionStatus:    PERSIAPAN->SETUP, MENGAJAR->TEACHING,
 *                     SELESAI->ENDED, EVALUASI->EVALUATED
 *   Difficulty:       dasar->easy, menengah->medium, lanjut->hard
 *   FindingCategory:  BENAR->CORRECT, KELIRU->WRONG,
 *                     TERLEWAT->MISSED, MEMBINGUNGKAN->CONFUSING
 */

import { z } from "zod";

/** The four sequential session states (§4.1). Forward-only, no going back. */
export const sessionStatusSchema = z.enum([
  "SETUP", // topic chosen, session created, not teaching yet
  "TEACHING", // teaching-turn loop active; snapshots flow
  "ENDED", // session ended, transcript locked, awaiting evaluation
  "EVALUATED", // evaluator ran; results available
]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

/** Topic difficulty level (§6.1). */
export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

/** Kinds of element Vision can detect on the board (§6.4). */
export const elementTypeSchema = z.enum([
  "text",
  "equation",
  "diagram",
  "arrow",
  "figure",
]);
export type ElementType = z.infer<typeof elementTypeSchema>;

/** Kinds of learner utterance — always in the student role (§6.8). */
export const learnerResponseTypeSchema = z.enum([
  "question",
  "confusion",
  "acknowledgment",
  "paraphrase",
]);
export type LearnerResponseType = z.infer<typeof learnerResponseTypeSchema>;

/** What triggered the learner's response (§6.8). */
export const derivedFromSchema = z.enum(["gap", "misconception", "new_info"]);
export type DerivedFrom = z.infer<typeof derivedFromSchema>;

/** Evaluation finding categories (§6.9). */
export const findingCategorySchema = z.enum([
  "CORRECT",
  "WRONG",
  "MISSED",
  "CONFUSING",
]);
export type FindingCategory = z.infer<typeof findingCategorySchema>;
