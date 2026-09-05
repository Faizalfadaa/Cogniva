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
import type { EvaluationResult } from "../../contracts/evaluation.js";
import type { LearnerResponse, LearnerState, Misc } from "../../contracts/learner.js";
import type { SpeechTranscript } from "../../contracts/speech.js";
import { runLearnerTurn } from "./learner.agent.js";
import type { LearnerTools } from "./learner.types";

export type { LearnerTools } from "./learner.types";

const MAX_SEED_MISCONCEPTIONS = 3;
const MAX_SEED_GAPS = 5;

export interface RespondArgs {
  topicTitle: string;
  topicDescription: string;
  interpretation: VisionInterpretation;
  speech: SpeechTranscript | null;
  state: LearnerState;
  turnIndex: number;
  /** Tools the orchestrator injects so the student can investigate (§2.3). */
  tools?: LearnerTools;
  /** Reports the turn's token cost back to the orchestrator (§7.3). */
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
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
 * Adaptive seed for the NEXT round (§4.3, complements resume): derive the
 * student's mental model from the PREVIOUS round's EvaluationResult instead of
 * the static commonMisconceptions, so the Learner now targets the user's REAL
 * weak spots. What the user explained well (CORRECT) is marked understood — the
 * student won't re-probe it; what was WRONG becomes an active misconception to
 * be corrected by re-teaching; what was MISSED/CONFUSING (plus the evaluator's
 * improvements) becomes an open gap to ask about.
 *
 * Only the user's own gaps flow to the Learner, never the answer key (§1.4): the
 * findings describe the user's explanation, and the student still holds beliefs
 * to be corrected rather than the correct answers. Where the evaluation is sparse
 * (e.g. the offline mock with no findings) it keeps the carried-over memory.
 */
export function seedLearnerStateFromEvaluation(
  sessionId: string,
  evaluation: EvaluationResult,
  previous?: LearnerState,
): LearnerState {
  // No usable signal from this round's evaluation (e.g. the offline mock with no
  // key concepts) -> keep the student's carried-over memory unchanged.
  if (evaluation.findings.length === 0 && evaluation.improvements.length === 0) {
    return previous ?? emptyLearnerState(sessionId);
  }

  const inCategory = (category: string): EvaluationResult["findings"] =>
    evaluation.findings.filter((f) => f.category === category);

  const activeMisconceptions: Misc[] = inCategory("WRONG")
    .slice(0, MAX_SEED_MISCONCEPTIONS)
    .map((f) => ({ concept: f.concept, belief: f.detail }));

  const openGaps = unique([
    ...inCategory("MISSED").map((f) => f.concept),
    ...inCategory("CONFUSING").map((f) => f.concept),
    ...evaluation.improvements,
  ]).slice(0, MAX_SEED_GAPS);

  const understoodConcepts = unique([
    ...(previous?.understoodConcepts ?? []),
    ...inCategory("CORRECT").map((f) => f.concept),
  ]);

  return {
    sessionId,
    understoodConcepts,
    // Keep prior misconceptions if this round flagged none new.
    activeMisconceptions: activeMisconceptions.length
      ? activeMisconceptions
      : previous?.activeMisconceptions ?? [],
    openGaps,
    questionsAsked: previous?.questionsAsked ?? [],
    updatedAtTurn: previous?.updatedAtTurn ?? 0,
  };
}

function emptyLearnerState(sessionId: string): LearnerState {
  return {
    sessionId,
    understoodConcepts: [],
    activeMisconceptions: [],
    openGaps: [],
    questionsAsked: [],
    updatedAtTurn: 0,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
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
    onUsage,
  }: RespondArgs): Promise<[LearnerResponse, LearnerState]> {
    const teachingText = [interpretation.transcribedText, speech?.transcript]
      .filter((text): text is string => Boolean(text && text.trim()))
      .join("\n\n");

    const output = await runLearnerTurn(
      { sessionId: state.sessionId, turnIndex, teachingText, currentState: state },
      { useMock: this.options.forceMock, tools, onUsage },
    );

    const response: LearnerResponse = {
      ...output.response,
      targetConcept: output.response.targetConcept ?? null,
    };
    return [response, output.nextState];
  }
}
