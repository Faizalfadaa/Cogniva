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
  speech?: string;
}

export interface EvaluationReportDTO {
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
