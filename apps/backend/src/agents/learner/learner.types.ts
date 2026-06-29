export type Misconception = {
  concept: string;
  belief: string;
};

export type LearnerState = {
  sessionId: string;
  understoodConcepts: string[];
  activeMisconceptions: Misconception[];
  openGaps: string[];
  questionsAsked: string[];
  updatedAtTurn: number;
};

export type LearnerResponseType =
  | "question"
  | "confusion"
  | "acknowledgment"
  | "paraphrase";

export type LearnerResponseDerivedFrom =
  | "gap"
  | "misconception"
  | "new_info";

export type LearnerResponse = {
  responseId: string;
  turnIndex: number;
  type: LearnerResponseType;
  text: string;
  targetConcept?: string;
  derivedFrom: LearnerResponseDerivedFrom;
};

export type LearnerAgentInput = {
  sessionId: string;
  turnIndex: number;

  /**
   * Semua data dari suara/whiteboard/Vision/ASR dianggap sudah diolah di bagian lain.
   * Bagian Learner cukup menerima text final ini.
   */
  teachingText: string;

  /**
   * State murid saat ini. Untuk giliran pertama, pakai createInitialLearnerState().
   */
  currentState: LearnerState;

  /** Nama tool yang boleh dipakai giliran ini (diisi oleh agent loop). */
  availableTools?: string[];

  /** Hasil tool yang sudah dikumpulkan murid giliran ini (agent loop). */
  observations?: AgentObservation[];
};

// ─── Lapisan agentic (§3.6: Learner sebagai agen — punya tujuan & memilih aksi) ───

/** Jenis aksi yang dipilih murid tiap giliran. */
export type LearnerActionKind = "respond" | "reread_board" | "recall_earlier";

/** "Gerakan" murid saat memutuskan merespons — dipilih dari celah terbesar. */
export type LearnerResponseStrategy =
  | "ask_clarification"
  | "request_example"
  | "challenge_claim"
  | "paraphrase"
  | "attempt_problem";

/** Keputusan murid: pakai tool dulu untuk menyelidiki, atau langsung merespons. */
export type LearnerAction = {
  kind: LearnerActionKind;
  /** reread_board: bagian papan yang ingin dilihat ulang. */
  focus?: string;
  /** recall_earlier: apa yang ingin diingat dari giliran sebelumnya. */
  query?: string;
  /** respond: gerakan murid yang dipilih untuk giliran ini. */
  strategy?: LearnerResponseStrategy;
};

/** Satu hasil pemakaian tool dalam satu giliran. */
export type AgentObservation = {
  kind: LearnerActionKind;
  detail: string;
  result: string;
};

/**
 * Tool yang disuntikkan orchestrator agar murid bisa MENYELIDIKI sebelum bertanya
 * (§2.3: murid tidak memanggil agen lain langsung — orchestrator yang menjahit).
 */
export type LearnerTools = {
  /** Baca ulang bagian papan tertentu secara terarah (lewat Vision). */
  rereadBoard?: (focus: string) => Promise<string>;
  /** Ingat kembali penjelasan dari giliran-giliran sebelumnya (memori sesi). */
  recallEarlier?: (query: string) => Promise<string>;
};

export type LearnerLLMOutput = {
  nextState: LearnerState;
  /** Aksi yang dipilih murid giliran ini; absen = langsung merespons. */
  action?: LearnerAction;
  response: {
    type: LearnerResponseType;
    text: string;
    targetConcept?: string;
    derivedFrom: LearnerResponseDerivedFrom;
  };
};

export type LearnerAgentOutput = {
  response: LearnerResponse;
  nextState: LearnerState;
};
