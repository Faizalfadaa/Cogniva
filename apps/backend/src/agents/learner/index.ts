/**
 * Learner agent — the heart of learning-by-teaching (Architecture Document §3.6).
 *
 * The learning logic lives in the team's module (`learner.agent.ts` +
 * `learner.guard.ts` + `learner.mock.ts` + `learner.prompt.ts`): it role-plays a
 * novice student, calls the LLM (Gemini, via the centralized wrapper) for a
 * structured `{ nextState, response }`, and guards the output to keep the
 * student persona. This file is the thin **adapter** that plugs that module into
 * the orchestrator's `Learner` seam, plus the topic-aware state seeding.
 *
 * INVARIANTS (§1.4): the Learner only ever receives the teaching text and its
 * own state — never the topic's referenceMaterial or keyConcepts. Initial state
 * is seeded from commonMisconceptions only.
 */

import type { VisionInterpretation } from "../../contracts/board.js";
import type { LearnerResponse, LearnerState, Misc } from "../../contracts/learner.js";
import type { SpeechTranscript } from "../../contracts/speech.js";
import { runLearnerTurn } from "./learner.agent.js";
import type { LearnerTools } from "./learner.types";

export type { LearnerTools } from "./learner.types";

const MAX_SEED_MISCONCEPTIONS = 3;

export interface RespondArgs {
  topicTitle: string;
  topicDescription: string;
  interpretation: VisionInterpretation;
  speech: SpeechTranscript | null;
  state: LearnerState;
  turnIndex: number;
  /** Tools the orchestrator injects so the student can investigate (§2.3). */
  tools?: LearnerTools;
}

/**
 * Seed the initial mental model from the topic's common misconceptions (§3.6).
 * Only commonMisconceptions flow to the Learner — never the answer key.
 */
export function seedLearnerState(
  sessionId: string,
  commonMisconceptions: string[],
  { topicTitle }: { topicTitle: string },
): LearnerState {
  const activeMisconceptions: Misc[] = commonMisconceptions
    .slice(0, MAX_SEED_MISCONCEPTIONS)
    .map((belief) => ({ concept: topicTitle, belief }));
  return {
    sessionId,
    understoodConcepts: [],
    activeMisconceptions,
    openGaps: [],
    questionsAsked: [],
    updatedAtTurn: 0,
  };
}

/**
 * Adapts the team's `runLearnerTurn` to the orchestrator's `Learner` seam:
 * board reading (+ speech) becomes the teaching text, and the result maps back
 * onto the `LearnerResponse` / `LearnerState` contracts.
 */
export class LearnerAgent {
  constructor(private readonly options: { forceMock?: boolean } = {}) {}

  async respond({
    interpretation,
    speech,
    state,
    turnIndex,
    tools,
  }: RespondArgs): Promise<[LearnerResponse, LearnerState]> {
    const teachingText = [interpretation.transcribedText, speech?.transcript]
      .filter((text): text is string => Boolean(text && text.trim()))
      .join("\n\n");

    const output = await runLearnerTurn(
      { sessionId: state.sessionId, turnIndex, teachingText, currentState: state },
      { useMock: this.options.forceMock, tools },
    );

    const response: LearnerResponse = {
      ...output.response,
      targetConcept: output.response.targetConcept ?? null,
    };
    return [response, output.nextState];
  }
}
