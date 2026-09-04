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
 *                        [ASR] --> speech -------------+
 *
 * If EITHER the board reading or the voice transcript needs confirmation (low
 * confidence or flagged ambiguity, §5.3), the turn pauses and asks the user
 * instead of running the Learner. `source` says which channel asked.
 */

import { LearnerAgent, VisionAgent, AsrAgent, seedLearnerState, type LearnerTools, type RespondArgs } from "../agents/index.js";
import type { AudioClip } from "../agents/asr/asr.types.js";
import * as config from "../config/index.js";
import type { BoardSnapshot, VisionInterpretation } from "../contracts/board.js";
import { utcNowIso } from "../contracts/common.js";
import type { LearnerResponse, LearnerState } from "../contracts/learner.js";
import type { Session } from "../contracts/session.js";
import type { SpeechTranscript } from "../contracts/speech.js";
import type { Topic } from "../contracts/topic.js";
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
    topic?: string,
  ): Promise<VisionInterpretation>;
}

/** An ASR agent the orchestrator can drive (real agent or a test fake). */
export interface Asr {
  transcribe(
    clip: AudioClip,
    typedText: string | null | undefined,
    topic?: string,
  ): Promise<SpeechTranscript>;
}

/** Outcome of one teaching turn the orchestrator hands back to the API layer. */
export interface TurnResult {
  kind: "learner" | "confirmation";
  interpretation?: VisionInterpretation;
  speech?: SpeechTranscript;
  response?: LearnerResponse;
  snapshotId?: string;
  suggestedClarification?: string;
  /** Which channel caused a "confirmation" pause. Only set for that kind. */
  source?: "board" | "voice";
}

export interface TeachingInput {
  image: string | null | undefined;
  /** Base64 audio clip for the voice channel (§3.5). Optional. */
  audio?: string | null | undefined;
  typedText: string | null | undefined;
}

export class Orchestrator {
  private readonly learner: Learner;
  private readonly vision: Vision;
  private readonly asr?: Asr;

  constructor({ learner, vision, asr }: { learner: Learner; vision: Vision; asr?: Asr }) {
    this.learner = learner;
    this.vision = vision;
    this.asr = asr;
  }

  /** Run one turn during TEACHING and persist it. */
  async runTeachingTurn(
    session: Session,
    topic: Topic,
    { image, audio, typedText }: TeachingInput,
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

    const interpretation = await this.vision.interpret(snapshot, typedText, topic.title);
    if (interpretation.needsConfirmation) {
      // Pause the turn and ask the user to confirm/correct (§5.3).
      return {
        kind: "confirmation",
        interpretation,
        snapshotId: snapshot.snapshotId,
        suggestedClarification: interpretation.suggestedClarification,
        source: "board",
      };
    }

    // Voice channel (§3.5): transcribe the audio clip when present. typedText is
    // the board-channel fallback, so it is NOT fed to ASR (that would duplicate
    // the same text into both channels). No audio (or no ASR) -> no speech.
    let speech: SpeechTranscript | null = null;
    if (this.asr && audio) {
      const clip: AudioClip = {
        segmentId: newId("seg"),
        sessionId: session.sessionId,
        turnIndex,
        audio,
        format: "webm",
        capturedAt: utcNowIso(),
      };
      speech = await this.asr.transcribe(clip, null, topic.title);
      sessions.saveTranscript(speech);

      if (speech.needsConfirmation) {
        // Same pause as the board reading above (§5.3), for the voice channel:
        // handing a probably-wrong transcript to the Learner teaches it the
        // wrong thing, so ask the teacher to confirm or retype first.
        return {
          kind: "confirmation",
          speech,
          snapshotId: snapshot.snapshotId,
          suggestedClarification: speech.suggestedClarification,
          source: "voice",
        };
      }
    }

    const state =
      sessions.getLearnerState(session.sessionId) ??
      seedLearnerState(session.sessionId, topic.commonMisconceptions, {
        topicTitle: topic.title,
      });

    // Tools the student may use to investigate before asking (§3.6). The
    // orchestrator owns the cross-agent calls (§2.3): the Learner only declares
    // intent ("re-read this", "recall that") and these closures execute it.
    const tools: LearnerTools = {
      rereadBoard: async (focus) => {
        try {
          const focused = await this.vision.interpret(
            snapshot,
            null,
            `${topic.title} — fokus baca ulang: ${focus}`,
          );
          return (
            focused.transcribedText?.trim() ||
            "(no additional detail could be read in that part)"
          );
        } catch {
          return "(failed to re-read the board)";
        }
      },
      recallEarlier: (query) =>
        Promise.resolve(recallFromTranscript(session.sessionId, query)),
    };

    const [response, newState] = await this.learner.respond({
      topicTitle: topic.title,
      topicDescription: topic.description,
      interpretation,
      speech,
      state,
      turnIndex,
      tools,
    });

    sessions.saveResponse(response);
    sessions.saveLearnerState(newState);
    sessions.saveTurn({
      turnIndex,
      sessionId: session.sessionId,
      snapshotId: snapshot.snapshotId,
      interpretation,
      speechTranscript: speech ?? undefined,
      typedInput: typedText ?? null,
      learnerResponseId: response.responseId,
      createdAt: utcNowIso(),
    });

    session.turnCount = turnIndex + 1;
    sessions.saveSession(session);

    return { kind: "learner", interpretation, speech: speech ?? undefined, response };
  }
}

/**
 * The student's "recall_earlier" tool: look back over the turns already taught
 * this session for the one most relevant to its query. Reads only the user's own
 * prior explanations (never the answer key, §1.4).
 */
function recallFromTranscript(sessionId: string, query: string): string {
  const turns = sessions.listTurns(sessionId);
  if (turns.length === 0) return "(no earlier explanation to recall yet)";

  const summarize = (t: (typeof turns)[number]): string =>
    [t.interpretation.transcribedText, t.speechTranscript?.transcript]
      .filter(Boolean)
      .join(" ");

  const keyword = query.toLowerCase().split(/\s+/).find((w) => w.length >= 4) ?? "";
  const hit = keyword
    ? turns.find((t) => summarize(t).toLowerCase().includes(keyword))
    : undefined;
  const chosen = hit ?? turns[turns.length - 1];

  return `Turn ${chosen.turnIndex}: ${summarize(chosen).slice(0, 280) || "(no text)"}`;
}

// --- Module-level singleton (built from config, overridable in tests) ------

let current: Orchestrator | null = null;

/**
 * Construct an Orchestrator. The Learner resolves its own LLM internally
 * (Gemini when a credential is set, otherwise the deterministic mock).
 * `useConfig: false` forces the offline mock — used by tests.
 */
export function buildOrchestrator({
  useConfig = true,
}: { useConfig?: boolean } = {}): Orchestrator {
  return new Orchestrator({
    learner: new LearnerAgent({ forceMock: !useConfig }),
    vision: new VisionAgent({ confidenceThreshold: config.VISION_CONFIDENCE_THRESHOLD }),
    asr: new AsrAgent({ confidenceThreshold: config.ASR_CONFIDENCE_THRESHOLD }),
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
