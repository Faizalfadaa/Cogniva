/**
 * Evaluator types (Architecture Document §3.7, §6.9).
 *
 * The Evaluator runs once, post-session, over the full transcript plus the
 * topic's referenceMaterial — the answer key the Learner never sees (§1.4).
 * Output conforms to the canonical EvaluationResult contract; finding
 * categories are the English enum (CORRECT/WRONG/MISSED/CONFUSING) per
 * docs/CONTRACTS.md, not the Indonesian PDF spelling.
 */

import type { FindingCategory } from "../../contracts/enums.js";
import type { EvaluationResult, Finding } from "../../contracts/evaluation.js";

export type { EvaluationResult, Finding, FindingCategory };

/**
 * One teaching turn flattened to just what the Evaluator reads. The orchestrator
 * stores full TeachingTurns (§6.6); the REST layer projects them down to this
 * shape (board reading + spoken transcript + the student's reply) so the agent
 * stays decoupled from storage.
 */
export interface TranscriptTurn {
  turnIndex: number;
  /** Vision's board reading (or the typed-text fallback) for this turn. */
  boardText: string;
  /** ASR transcript of the teacher's spoken explanation, if any (§6.5). */
  speech?: string;
  /** The student's (Learner's) utterance this turn — question/confusion/etc. */
  learnerUtterance?: string;
}

/**
 * Everything the Evaluator needs for one assessment. `referenceMaterial`,
 * `keyConcepts`, and `commonMisconceptions` come from the Topic (§6.1); the full
 * reference is the source of truth the Evaluator grades against (§3.7).
 */
export interface EvaluatorInput {
  sessionId: string;
  turns: TranscriptTurn[];
  referenceMaterial: string;
  keyConcepts: string[];
  commonMisconceptions: string[];
}
