import { LearnerState } from "./learner.types";

export function createInitialLearnerState(sessionId: string): LearnerState {
  return {
    sessionId,
    understoodConcepts: [],
    activeMisconceptions: [],
    openGaps: [],
    questionsAsked: [],
    updatedAtTurn: 0
  };
}
