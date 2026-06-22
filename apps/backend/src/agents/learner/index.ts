/**
 * Learner agent — the heart of learning-by-teaching (Architecture Document §3.6).
 *
 * The Learner role-plays a novice student. Each turn it compares what the
 * teacher just explained against its current (deliberately imperfect) mental
 * model and responds in-character: a naive question, an expression of
 * confusion, or a paraphrase. It then updates its LearnerState.
 *
 * INVARIANTS ENFORCED HERE (§1.4):
 * - The Learner stays in the student role; it never corrects, grades, or teaches.
 * - It never holds the answer key. This only ever receives the topic
 *   title/description, what was explained, and its own state — never the topic's
 *   referenceMaterial or keyConcepts.
 * - Initial state is seeded from the topic's commonMisconceptions only.
 *
 * If no LLM is configured, a deterministic fallback keeps the loop running so
 * the end-to-end skeleton works without an API key.
 */

import type { VisionInterpretation } from "../../contracts/board.js";
import type { DerivedFrom, LearnerResponseType } from "../../contracts/enums.js";
import type { LearnerResponse, LearnerState, Misc } from "../../contracts/learner.js";
import type { SpeechTranscript } from "../../contracts/speech.js";
import type { LLM } from "../../llm/index.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  LEARNER_OUTPUT_SCHEMA,
} from "../../llm/prompts/learner.js";
import { newId } from "../../modules/storage/sessionStore.js";

const MAX_SEED_MISCONCEPTIONS = 3;

const log = (msg: string) => console.warn(`[cogniva.learner] ${msg}`);

/** Shape the LLM returns under the structured-output schema. */
interface LearnerLlmPayload {
  response: {
    type: LearnerResponseType;
    text: string;
    targetConcept?: string;
    derivedFrom: DerivedFrom;
  };
  understoodConcepts?: string[];
  activeMisconceptions?: Misc[];
  openGaps?: string[];
}

export interface RespondArgs {
  topicTitle: string;
  topicDescription: string;
  interpretation: VisionInterpretation;
  speech: SpeechTranscript | null;
  state: LearnerState;
  turnIndex: number;
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

/** Produces a student response + updated state for one teaching turn. */
export class LearnerAgent {
  constructor(private readonly llm: LLM | null) {}

  async respond(args: RespondArgs): Promise<[LearnerResponse, LearnerState]> {
    if (this.llm !== null) {
      try {
        return await this.respondWithLlm(this.llm, args);
      } catch (err) {
        // Never crash the teaching loop; fall back to the deterministic student.
        log(`LLM failed; using fallback: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return this.fallback(args.state, args.turnIndex);
  }

  // --- LLM path ----------------------------------------------------------

  private async respondWithLlm(
    llm: LLM,
    { topicTitle, topicDescription, interpretation, speech, state, turnIndex }: RespondArgs,
  ): Promise<[LearnerResponse, LearnerState]> {
    const system = buildSystemPrompt(topicTitle, topicDescription || "");
    const user = buildUserPrompt(interpretation, speech, state);
    const data = (await llm.structured({
      system,
      user,
      schema: LEARNER_OUTPUT_SCHEMA,
    })) as unknown as LearnerLlmPayload;

    const raw = data.response;
    const target = (raw.targetConcept ?? "").trim() || null;
    const response: LearnerResponse = {
      responseId: newId("resp"),
      turnIndex,
      type: raw.type,
      text: raw.text,
      targetConcept: target,
      derivedFrom: raw.derivedFrom,
    };

    const questionsAsked = [...state.questionsAsked];
    if (response.type === "question") {
      questionsAsked.push(response.text);
    }
    const newState: LearnerState = {
      sessionId: state.sessionId,
      understoodConcepts: [...(data.understoodConcepts ?? [])],
      activeMisconceptions: (data.activeMisconceptions ?? []).map((m) => ({
        concept: m.concept,
        belief: m.belief,
      })),
      openGaps: [...(data.openGaps ?? [])],
      questionsAsked,
      updatedAtTurn: turnIndex,
    };
    return [response, newState];
  }

  // --- Deterministic fallback (no LLM configured) ------------------------

  private fallback(state: LearnerState, turnIndex: number): [LearnerResponse, LearnerState] {
    let response: LearnerResponse;
    if (state.activeMisconceptions.length > 0) {
      const misc = state.activeMisconceptions[0];
      response = {
        responseId: newId("resp"),
        turnIndex,
        type: "confusion",
        text:
          `Wait, I'm a bit confused about ${misc.concept}. I had it in ` +
          `my head that "${misc.belief}" — did I get that wrong?`,
        targetConcept: misc.concept,
        derivedFrom: "misconception",
      };
    } else if (state.openGaps.length > 0) {
      const gap = state.openGaps[0];
      response = {
        responseId: newId("resp"),
        turnIndex,
        type: "question",
        text: `I don't think I follow the part about ${gap}. Could you explain that again?`,
        targetConcept: gap,
        derivedFrom: "gap",
      };
    } else {
      response = {
        responseId: newId("resp"),
        turnIndex,
        type: "confusion",
        text:
          "Hmm, I think I followed some of that, but I'm a little lost. " +
          "Could you go over it once more, a bit more slowly?",
        targetConcept: null,
        derivedFrom: "new_info",
      };
    }

    const questionsAsked = [...state.questionsAsked];
    if (response.type === "question") {
      questionsAsked.push(response.text);
    }
    const newState: LearnerState = {
      sessionId: state.sessionId,
      understoodConcepts: [...state.understoodConcepts],
      activeMisconceptions: [...state.activeMisconceptions],
      openGaps: [...state.openGaps],
      questionsAsked,
      updatedAtTurn: turnIndex,
    };
    return [response, newState];
  }
}
