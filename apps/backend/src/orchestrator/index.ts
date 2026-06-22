/**
 * Orchestrator — stitches one teaching turn end to end (Architecture Document §3.3, §5.1).
 *
 * This is the M1 critical path: receive a teaching input, read the board (Vision
 * — passthrough in M1), call the Learner, persist the turn, and return what to
 * send back. The orchestrator is the single owner of session truth; agents
 * never call each other directly (§2.3).
 *
 *     teaching input --> [Vision] --> interpretation --+
 *                                                       +--> [Learner] --> response
 *                        (M2: [ASR] --> speech) --------+
 *
 * If the board reading needs confirmation (low confidence, §5.3), the turn
 * pauses and asks the user instead of running the Learner.
 */

import { LearnerAgent, VisionAgent, seedLearnerState, type RespondArgs } from "../agents/index.js";
import * as config from "../config/index.js";
import type { BoardSnapshot, VisionInterpretation } from "../contracts/board.js";
import { utcNowIso } from "../contracts/common.js";
import type { LearnerResponse, LearnerState } from "../contracts/learner.js";
import type { Session } from "../contracts/session.js";
import type { Topic } from "../contracts/topic.js";
import { LLMClient } from "../llm/index.js";
import { newId, sessions } from "../modules/storage/sessionStore.js";

/** A learner the orchestrator can drive (real agent or a test fake). */
export interface Learner {
  respond(args: RespondArgs): Promise<[LearnerResponse, LearnerState]>;
}

/** A vision agent the orchestrator can drive (real stub or a test fake). */
export interface Vision {
  interpret(
    snapshot: BoardSnapshot,
    typedText: string | null | undefined,
  ): VisionInterpretation;
}

/** Outcome of one teaching turn the orchestrator hands back to the API layer. */
export interface TurnResult {
  kind: "learner" | "confirmation";
  interpretation?: VisionInterpretation;
  response?: LearnerResponse;
  snapshotId?: string;
  suggestedClarification?: string;
}

export interface TeachingInput {
  image: string | null | undefined;
  typedText: string | null | undefined;
}

export class Orchestrator {
  private readonly learner: Learner;
  private readonly vision: Vision;

  constructor({ learner, vision }: { learner: Learner; vision: Vision }) {
    this.learner = learner;
    this.vision = vision;
  }

  /** Run one turn during TEACHING and persist it. */
  async runTeachingTurn(
    session: Session,
    topic: Topic,
    { image, typedText }: TeachingInput,
  ): Promise<TurnResult> {
    const turnIndex = session.turnCount;

    const snapshot: BoardSnapshot = {
      snapshotId: newId("snap"),
      sessionId: session.sessionId,
      turnIndex,
      image: image ?? "",
      format: "png",
      capturedAt: utcNowIso(),
    };
    sessions.saveSnapshot(snapshot);

    const interpretation = this.vision.interpret(snapshot, typedText);
    if (interpretation.needsConfirmation) {
      // Pause the turn and ask the user to confirm/correct (§5.3).
      return {
        kind: "confirmation",
        interpretation,
        snapshotId: snapshot.snapshotId,
        suggestedClarification: interpretation.suggestedClarification,
      };
    }

    const state =
      sessions.getLearnerState(session.sessionId) ??
      seedLearnerState(session.sessionId, topic.commonMisconceptions, {
        topicTitle: topic.title,
      });

    const [response, newState] = await this.learner.respond({
      topicTitle: topic.title,
      topicDescription: topic.description,
      interpretation,
      speech: null, // TODO(M2): pass the ASR transcript
      state,
      turnIndex,
    });

    sessions.saveResponse(response);
    sessions.saveLearnerState(newState);
    sessions.saveTurn({
      turnIndex,
      sessionId: session.sessionId,
      snapshotId: snapshot.snapshotId,
      interpretation,
      typedInput: typedText ?? null,
      learnerResponseId: response.responseId,
      createdAt: utcNowIso(),
    });

    session.turnCount = turnIndex + 1;
    sessions.saveSession(session);

    return { kind: "learner", interpretation, response };
  }
}

// --- Module-level singleton (built from config, overridable in tests) ------

let current: Orchestrator | null = null;

/** Construct an Orchestrator. With useConfig, build the LLM from env. */
export function buildOrchestrator({
  llm = null,
  useConfig = true,
}: { llm?: LLMClient | null; useConfig?: boolean } = {}): Orchestrator {
  let resolved = llm;
  if (resolved === null && useConfig && config.llmAvailable()) {
    resolved = new LLMClient({
      model: config.LEARNER_MODEL,
      maxTokens: config.LLM_MAX_TOKENS,
      timeout: config.LLM_TIMEOUT,
    });
  }
  return new Orchestrator({
    learner: new LearnerAgent(resolved),
    vision: new VisionAgent({ confidenceThreshold: config.VISION_CONFIDENCE_THRESHOLD }),
  });
}

export function getOrchestrator(): Orchestrator {
  if (current === null) {
    current = buildOrchestrator();
  }
  return current;
}

/** Override the singleton (used by tests to force the offline fallback). */
export function setOrchestrator(orchestrator: Orchestrator | null): void {
  current = orchestrator;
}
