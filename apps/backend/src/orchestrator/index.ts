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
 *
 * Every turn also meters its own token spend onto the session, and refuses to
 * start once the session is over its budget (§7.3).
 */

import { LearnerAgent, VisionAgent, AsrAgent, seedLearnerState, type LearnerTools, type RespondArgs } from "../agents/index.js";
import type { AudioClip } from "../agents/asr/asr.types.js";
import { focusInterpretation } from "../agents/vision/vision.focus.js";
import * as config from "../config/index.js";
import type { BoardSnapshot, Element, VisionInterpretation } from "../contracts/board.js";
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

/** Reports one LLM call's token cost back to the orchestrator (§7.3). */
export type UsageReporter = (usage: {
  inputTokens: number;
  outputTokens: number;
}) => void;

/** A vision agent the orchestrator can drive (real stub or a test fake). */
export interface Vision {
  interpret(
    snapshot: BoardSnapshot,
    typedText: string | null | undefined,
    topic?: string,
    /** What the board showed at the end of the previous turn (§3.4). */
    previousElements?: Element[],
    onUsage?: UsageReporter,
  ): Promise<VisionInterpretation>;
}

/** An ASR agent the orchestrator can drive (real agent or a test fake). */
export interface Asr {
  transcribe(
    clip: AudioClip,
    typedText: string | null | undefined,
    topic?: string,
    onUsage?: UsageReporter,
  ): Promise<SpeechTranscript>;
}

/** Outcome of one teaching turn the orchestrator hands back to the API layer. */
export interface TurnResult {
  kind: "learner" | "confirmation" | "budget_exceeded";
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
    // Budget gate (§7.3), before anything else: once a session is out of
    // tokens we refuse the turn without calling Vision, ASR or the Learner.
    // DEMO_MODE skips only the ENFORCEMENT -- measurement below still runs.
    if (!config.DEMO_MODE && session.tokensUsed >= config.SESSION_TOKEN_BUDGET) {
      return { kind: "budget_exceeded" };
    }

    const turnIndex = session.turnCount;

    // Every agent reports its token cost here; the total lands on the session
    // via recordUsage() on the way out, whichever exit this turn takes.
    let turnTokens = 0;
    const onUsage: UsageReporter = (usage): void => {
      turnTokens += usage.inputTokens + usage.outputTokens;
    };
    const recordUsage = (): void => {
      sessions.addTokenUsage(session.sessionId, turnTokens);
    };

    const snapshot: BoardSnapshot = {
      snapshotId: newId("snap"),
      sessionId: session.sessionId,
      turnIndex,
      image: image ?? "",
      format: "png",
      capturedAt: utcNowIso(),
    };
    sessions.saveSnapshot(snapshot);

    // Continuity between turns (§3.4): the board is drawn incrementally, so
    // Vision is told what it read last time. Only completed turns are stored,
    // so a turn that paused for confirmation leaves no stale context behind.
    const previousTurns = sessions.listTurns(session.sessionId);
    const previousElements = previousTurns.length
      ? previousTurns[previousTurns.length - 1].interpretation.elements
      : undefined;

    const interpretation = await this.vision.interpret(
      snapshot,
      typedText,
      topic.title,
      previousElements,
      onUsage,
    );
    if (interpretation.needsConfirmation) {
      // Pause the turn and ask the user to confirm/correct (§5.3). Vision
      // already ran, so its tokens count even though the turn didn't finish.
      recordUsage();
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
      speech = await this.asr.transcribe(clip, null, topic.title, onUsage);
      sessions.saveTranscript(speech);

      if (speech.needsConfirmation) {
        recordUsage();
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
      // The board is a static image we already read once this turn, so a
      // "re-read" is a lookup in that existing interpretation -- not a second
      // multimodal call costing thousands of tokens and a round trip (§7.3).
      // No network, so nothing here can fail.
      rereadBoard: (focus) =>
        Promise.resolve(focusInterpretation(interpretation, focus)),
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
      onUsage,
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
    recordUsage();

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
