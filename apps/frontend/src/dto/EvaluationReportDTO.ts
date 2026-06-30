export interface EvaluationNotebookDTO {
  learned: string[];
  stillConfused: string[];
  reflection: string;
}

export interface EvaluationReportDTO {
  /** A letter from the learner to the user */
  letter: string;
  notebook: EvaluationNotebookDTO;
  /** Daftar topik rekomendasi belajar selanjutnya */
  continueLearning: string[];
}