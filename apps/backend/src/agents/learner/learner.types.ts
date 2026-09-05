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
   * All data from voice/whiteboard/Vision/ASR is assumed already processed
   * elsewhere. The Learner only needs to receive this final text.
   */
  teachingText: string;

  /**
   * The student's current state. For the first turn, use createInitialLearnerState().
   */
  currentState: LearnerState;

  /** Names of the tools allowed this turn (filled by the agent loop). */
  availableTools?: string[];

  /** Tool results the student has gathered this turn (agent loop). */
  observations?: AgentObservation[];
};

// ─── Agentic layer (§3.6: Learner as an agent — has a goal & chooses actions) ───

/** The kind of action the student chooses each turn. */
export type LearnerActionKind = "respond" | "reread_board" | "recall_earlier";

/** The student's "move" when deciding to respond — chosen from the biggest gap. */
export type LearnerResponseStrategy =
  | "ask_clarification"
  | "request_example"
  | "challenge_claim"
  | "paraphrase"
  | "attempt_problem";

/** The student's decision: use a tool to investigate first, or respond directly. */
export type LearnerAction = {
  kind: LearnerActionKind;
  /** reread_board: the part of the board to look at again. */
  focus?: string;
  /** recall_earlier: what to remember from an earlier turn. */
  query?: string;
  /** respond: the student's chosen move for this turn. */
  strategy?: LearnerResponseStrategy;
};

/** A single tool-use result within one turn. */
export type AgentObservation = {
  kind: LearnerActionKind;
  detail: string;
  result: string;
};

/**
 * Tools injected by the orchestrator so the student can INVESTIGATE before asking
 * (§2.3: the student never calls other agents directly — the orchestrator stitches it).
 */
export type LearnerTools = {
  /** Re-read a specific part of the board in a directed way (via Vision). */
  rereadBoard?: (focus: string) => Promise<string>;
  /** Recall explanations from earlier turns (session memory). */
  recallEarlier?: (query: string) => Promise<string>;
};

export type LearnerLLMOutput = {
  nextState: LearnerState;
  /** The action the student chose this turn; absent = respond directly. */
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
