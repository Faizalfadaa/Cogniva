export interface EvaluationNotebookDTO {
  learned: string[];
  stillConfused: string[];
  reflection: string;
}

export interface EvaluationReportDTO {
  /** A letter from the learner to the user */
  letter: string;
  notebook: EvaluationNotebookDTO;
  /** Recommended topics to study next */
  continueLearning: string[];
}