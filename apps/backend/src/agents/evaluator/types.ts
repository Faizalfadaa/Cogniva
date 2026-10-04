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
 * shape (board reading + spoken transcript + the student's reply + the chat
 * that followed) so the agent stays decoupled from storage.
 */
export interface TranscriptTurn {
  turnIndex: number;
  /** Vision's board reading (or the typed-text fallback) for this turn. */
  boardText: string;
  /**
   * What was added to the board this turn, read on its own. `boardText` is the
   * whole board, so a concept written in turn 1 appears in every turn after it;
   * this is how the Evaluator tells where it was actually introduced. Absent
   * when unknown (a board's first reading), empty when nothing new was drawn.
   */
  newBoardText?: string;
  /** ASR transcript of the teacher's spoken explanation, if any (§6.5). */
  speech?: string;
  /** The student's (Learner's) utterance this turn — question/confusion/etc. */
  learnerUtterance?: string;
  /**
   * The chat that followed this turn, both sides, in the order it was sent.
   *
   * The board and the microphone are not the only places teaching happens. The
   * student asks a question in the chat panel and the user answers it there,
   * and that answer is often the most pointed explanation in the whole session,
   * because it is aimed at a confusion the student just named. The Evaluator
   * read none of it until this field existed: a concept explained only in chat
   * was scored MISSED, and one explained wrongly in chat cost nothing.
   *
   * Both sides are here because the user's line rarely stands on its own. "Yes,
   * the thylakoid membrane" is only judgeable next to the question it answers.
   */
  chat?: ChatExchange[];
}

/** One chat bubble, flattened to the two things the Evaluator reads. */
export interface ChatExchange {
  /** "user" is the teacher; "learner" is the student persona. */
  sender: "user" | "learner";
  text: string;
}

/**
 * One retrieved passage of the reference material, with a label saying where in
 * the document it came from. Produced by modules/retrieval; the agent stays
 * decoupled from how retrieval works.
 */
export interface ReferenceExcerpt {
  label: string;
  text: string;
}

/**
 * Everything the Evaluator needs for one assessment. `keyConcepts` and
 * `commonMisconceptions` come from the Topic (§6.1).
 *
 * The reference material reaches the agent in one of two ways:
 *
 *  - `referenceExcerpts` + `referenceOutline` — the RAG path. Only the passages
 *    relevant to what the user taught are included, plus a one-line-per-section
 *    outline of the whole document so a concept the user never mentioned can
 *    still be recognised as MISSED.
 *  - `referenceMaterial` — the whole document, used when there is no index
 *    (curated demo topics, whose reference is short enough to send in full).
 *
 * When excerpts are present they take precedence and the full text is not sent.
 */
export interface EvaluatorInput {
  sessionId: string;
  turns: TranscriptTurn[];
  referenceMaterial: string;
  keyConcepts: string[];
  commonMisconceptions: string[];
  /** Retrieved passages (RAG path). Empty or absent -> use referenceMaterial. */
  referenceExcerpts?: ReferenceExcerpt[];
  /** One line per section of the whole document, for coverage awareness. */
  referenceOutline?: string[];
}
