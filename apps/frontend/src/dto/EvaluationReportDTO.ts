export interface EvaluationNotebookDTO {
  learned: string[];
  stillConfused: string[];
  reflection: string;
}

export interface EvaluationReportDTO {
  /** Surat dari learner ke user */
  letter: string;
  notebook: EvaluationNotebookDTO;
  /** Daftar topik rekomendasi belajar selanjutnya */
  continueLearning: string[];
}