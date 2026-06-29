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
};

export type LearnerLLMOutput = {
  nextState: LearnerState;
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
