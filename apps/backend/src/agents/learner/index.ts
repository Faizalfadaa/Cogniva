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
import type { Timeline } from "../../contracts/timeline.js";
import { narrate } from "./narration.js";
import { runLearnerTurn } from "./learner.agent.js";
import { EARLIER_BOARD_HEADING } from "./learner.depth.js";
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
  /** When each board change was made, on the audio clip's clock (see narration.ts). */
  timeline?: Timeline;
  /** The character's name, which the student answers to (see LearnerAgentInput). */
  learnerName?: string;
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
    // The repeat tally starts over for the new round: the user is about to teach
    // this material again, so the student gets its two questions per concept
    // again rather than opening the round already out of them.
    askedConcepts: [],
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
 * What the student is told the teacher did this turn.
 *
 * The board is sent whole on every turn, so its reading holds everything ever
 * written on it. Handed over as one block, all of it read as "what the teacher
 * just explained", and the student kept asking about material the lesson had
 * already left behind: usually the oldest part, since that sits at the top of
 * the board and is read first.
 *
 * When the orchestrator knows which part is new (`newText`), the turn is laid
 * out the way it actually happened: what was just drawn, what was just said,
 * and then the rest of the board, marked as earlier material to keep in mind
 * rather than to react to. Without it (the first reading of a board, where all
 * of it is new, or a chat message), the old single block is still right.
 */
export function composeTeachingText(
  interpretation: VisionInterpretation,
  speech: SpeechTranscript | null,
  timeline?: Timeline,
): string {
  const board = interpretation.transcribedText.trim();
  const said = speech?.transcript?.trim() ?? "";
  const lines = narrate(timeline?.events, speech?.segments);
  const lined = lines.length
    ? `How the drawing and the talking lined up:\n${lines.map((l) => `- ${l}`).join("\n")}`
    : "";

  if (interpretation.newText === undefined) {
    return [board, said, lined].filter(Boolean).join("\n\n");
  }

  const fresh = interpretation.newText.trim();
  const sections = [
    `Just added to the board this turn:\n${fresh || "(nothing new was drawn on the board this turn)"}`,
  ];
  if (said) sections.push(`Said out loud this turn:\n${said}`);
  if (lined) sections.push(lined);
  if (board) {
    sections.push(
      `${EARLIER_BOARD_HEADING}, including earlier material (context, not what was just taught):\n${board}`,
    );
  }
  return sections.join("\n\n");
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
    timeline,
    learnerName,
  }: RespondArgs): Promise<[LearnerResponse, LearnerState]> {
    const teachingText = composeTeachingText(interpretation, speech, timeline);

    const output = await runLearnerTurn(
      { sessionId: state.sessionId, turnIndex, teachingText, currentState: state, learnerName },
      { useMock: this.options.forceMock, tools, onUsage },
    );

    const response: LearnerResponse = {
      ...output.response,
      targetConcept: output.response.targetConcept ?? null,
    };
    return [response, output.nextState];
  }
}
