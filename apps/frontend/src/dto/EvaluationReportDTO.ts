export interface EvaluationNotebookDTO {
  learned: string[];
  stillConfused: string[];
  reflection: string;
}

/** Mirrors Finding in backend contracts/evaluation.ts (§6.9). */
export interface EvaluationFindingDTO {
  category: "CORRECT" | "WRONG" | "MISSED" | "CONFUSING";
  concept: string;
  detail: string;
  /** Which transcript turn this finding came from, if any. */
  evidenceTurnIndex?: number | null;
  /**
   * The exact words in that turn behind this finding, for highlighting.
   *
   * The backend only sends this after confirming it really occurs in the turn,
   * so a search for it will hit. Absent when the model could not quote the turn
   * word for word, or when the finding is a MISSED concept with nothing to
   * point at: highlight the whole turn in that case.
   */
  sourceQuote?: string;
  /**
   * One concrete thing to do about this finding next time.
   *
   * Absent on a CORRECT finding: nothing needs fixing there.
   */
  followUp?: string;
}

/** One teaching turn a finding can be shown against. */
export interface EvaluationTranscriptTurnDTO {
  turnIndex: number;
  boardText: string;
  /**
   * What was added to the board this turn. `boardText` is the whole board, so
   * everything written earlier repeats in every later turn; this is the part
   * that was new. Absent when unknown, empty when nothing new was drawn.
   */
  newBoardText?: string;
  speech?: string;
  /**
   * The chat that followed this turn, both sides, in the order it was sent.
   *
   * Teaching does not only happen on the board. The student asks in the chat
   * panel and the user answers there, and that answer is part of the lesson
   * the debrief is reviewing. Both sides are kept because the user's reply
   * only makes sense under the question it answers; only the user's half is
   * marked up with findings.
   */
  chat?: EvaluationChatMessageDTO[];
}

/** One chat bubble under a turn. */
export interface EvaluationChatMessageDTO {
  sender: 'user' | 'learner';
  text: string;
}

export interface EvaluationReportDTO {
  /**
   * Which finished round this debrief belongs to, counting from 1.
   *
   * A workspace keeps one report per round, so choosing "continue teaching"
   * and finishing again adds a round instead of overwriting the last one.
   */
  round: number;
  /** When this round's debrief was written. */
  createdAt: string;
  /** A letter from the learner to the user */
  letter: string;
  notebook: EvaluationNotebookDTO;
  /** Recommended topics to study next */
  continueLearning: string[];
  /** Overall correctness and completeness, 0..100. */
  score: number;
  /**
   * How deeply the mechanism was explained, 0..100, scored separately from
   * `score`: a correct but shallow explanation scores high there and low here.
   */
  depthScore: number;
  findings: EvaluationFindingDTO[];
  /** The turns `findings` cite. Empty when the report was built without one. */
  transcript?: EvaluationTranscriptTurnDTO[];
}

/**
 * One finished session's score, for the trend across sessions.
 *
 * Fetched apart from the report because a report describes one session and
 * cannot know what came after it.
 */
export interface ScoreHistoryPointDTO {
  workspaceId: string;
  /** Which round of that workspace this score came from. */
  round: number;
  title: string | null;
  score: number;
  /** When the report was written, oldest first. */
  completedAt: string;
}

/**
 * One finished round of a workspace, as the round picker lists them.
 *
 * Only enough to label a round and show how it went — the full debrief is
 * fetched when a round is actually opened.
 */
export interface EvaluationRoundSummaryDTO {
  round: number;
  score: number;
  depthScore: number;
  findingCount: number;
  createdAt: string;
}
