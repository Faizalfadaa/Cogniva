/**
 * Orchestrator — runs one teaching turn, step by planned step (§3.3, §5.1).
 *
 * It used to be a fixed pipeline: Vision, then ASR, then the Learner, in that
 * order, every turn, whether or not each step had anything to do. It is now a
 * *supervisor*: a Planner agent (§S5) looks at the turn's actual state and names
 * the next step, the Orchestrator executes it, and the loop repeats against the
 * updated state until a terminal step ends the turn.
 *
 *              +---------------------------------------+
 *              v                                       |
 *     [Planner] --> step --> execute (Vision/ASR/Learner) --> new state
 *              ^                                       |
 *              +--------- re-plan on a surprise --------+
 *
 * What that buys, concretely: an unchanged board skips Vision entirely, a turn
 * with no audio never touches ASR, and a low-confidence reading gets a directed
 * second look before the user is interrupted.
 *
 * Two invariants survive the change unchanged:
 *   - agents still never call each other (§2.3) — the Orchestrator remains the
 *     single owner of coordination, and the Planner only names steps;
 *   - the Learner still never sees the answer key (§1.4).
 *
 * Everything is bounded: PLANNER_MAX_STEPS steps per turn, PLANNER_MAX_REPLANS
 * re-plans, and a deterministic rule engine behind the model so the whole loop
 * runs offline (§10).
 */

import { createHash } from "node:crypto";

import {
  LearnerAgent,
  VisionAgent,
  AsrAgent,
  PlannerAgent,
  decideStep,
  seedLearnerState,
  shouldReplan,
  takeFeasible,
  type LearnerTools,
  type Plan,
  type PlanStep,
  type PlanStepKind,
  type PlanTraceEntry,
  type RespondArgs,
  type TurnSituation,
} from "../agents/index.js";
import type { AudioClip } from "../agents/asr/asr.types.js";
import * as config from "../config/index.js";
import type { BoardSnapshot, VisionInterpretation } from "../contracts/board.js";
import { utcNowIso } from "../contracts/common.js";
import type { LearnerResponse, LearnerState } from "../contracts/learner.js";
import type { Session } from "../contracts/session.js";
import type { SpeechTranscript } from "../contracts/speech.js";
import type { TeachingTurn } from "../contracts/teaching.js";
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

/** A planner the orchestrator can drive (real agent or a test fake). */
export interface Planner {
  plan(situation: TurnSituation): Promise<Plan>;
}

/** Outcome of one teaching turn the orchestrator hands back to the API layer. */
export interface TurnResult {
  kind: "learner" | "confirmation";
  interpretation?: VisionInterpretation;
  speech?: SpeechTranscript;
  response?: LearnerResponse;
  snapshotId?: string;
  suggestedClarification?: string;
  /** The steps that actually ran, in order (§S8 tracing). */
  plan?: PlanTraceEntry[];
}

export interface TeachingInput {
  image: string | null | undefined;
  /** Base64 audio clip for the voice channel (§3.5). Optional. */
  audio?: string | null | undefined;
  typedText: string | null | undefined;
  /**
   * Whether this caller can act on a "confirmation" result. The workspace UI has
   * no confirmation step (§K1), so it passes false and the turn proceeds on
   * Vision's best guess instead of stalling.
   */
  allowConfirmation?: boolean;
}

/** Stand-in board text when the reading is empty and we must proceed anyway. */
const FALLBACK_BOARD_TEXT = "The explanation on the whiteboard";

/** Everything one turn accumulates — the blackboard the Planner reads (§S6). */
interface TurnContext {
  interpretation: VisionInterpretation | null;
  speech: SpeechTranscript | null;
  completed: PlanStepKind[];
}

/** What every step execution needs; assembled once per turn. */
interface StepArgs {
  session: Session;
  topic: Topic;
  snapshot: BoardSnapshot;
  typedText: string | null | undefined;
  audio: string | null | undefined;
  turnIndex: number;
  previousTurn: TeachingTurn | undefined;
  allowConfirmation: boolean;
  ctx: TurnContext;
}

export class Orchestrator {
  private readonly learner: Learner;
  private readonly vision: Vision;
  private readonly asr?: Asr;
  private readonly planner: Planner;

  constructor({
    learner,
    vision,
    asr,
    planner,
  }: {
    learner: Learner;
    vision: Vision;
    asr?: Asr;
    /** Omitted -> the real Planner agent (rules-only when offline). */
    planner?: Planner;
  }) {
    this.learner = learner;
    this.vision = vision;
    this.asr = asr;
    this.planner = planner ?? new PlannerAgent();
  }

  /** Run one turn during TEACHING and persist it. */
  async runTeachingTurn(
    session: Session,
    topic: Topic,
    { image, audio, typedText, allowConfirmation = true }: TeachingInput,
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

    const previousTurn = lastTurn(session.sessionId);
    const ctx: TurnContext = { interpretation: null, speech: null, completed: [] };
    const trace: PlanTraceEntry[] = [];
    const args: StepArgs = {
      session,
      topic,
      snapshot,
      typedText,
      audio,
      turnIndex,
      previousTurn,
      allowConfirmation,
      ctx,
    };

    const situationNow = (): TurnSituation =>
      buildSituation(args, config.PLANNER_MAX_STEPS - trace.length);

    let plan = await this.planner.plan(situationNow());
    let remaining = plan.steps;
    let replans = 0;

    for (let i = 0; i < config.PLANNER_MAX_STEPS; i++) {
      const situation = situationNow();

      // The board came back unreadable (or some other surprise): the rest of the
      // plan was drafted for a turn that did not happen, so ask for a new one.
      if (replans < config.PLANNER_MAX_REPLANS && shouldReplan(situation, remaining)) {
        plan = await this.planner.plan(situation);
        remaining = plan.steps;
        replans++;
      }

      const taken = takeFeasible(remaining, situation);
      remaining = taken.rest;
      // Plan exhausted, or nothing left in it applies -> the rule engine always
      // has an answer, so a turn can never stall on a bad plan.
      const step = taken.step ?? decideStep(situation);
      const source = taken.step ? plan.source : "fallback";

      const startedAt = Date.now();
      const outcome = await this.runStep(step, args);
      ctx.completed.push(step.kind);
      trace.push({
        kind: step.kind,
        reason: step.reason,
        source,
        durationMs: Date.now() - startedAt,
      });

      if (outcome) {
        logPlan(session.sessionId, turnIndex, trace);
        return { ...outcome, plan: trace };
      }
    }

    // Budget spent on preparation without reaching the student. The rule engine
    // makes this unreachable in practice; finishing the turn anyway is still the
    // right failure mode (§10: the user always gets a reply).
    const forced = await this.askLearner(args);
    trace.push({
      kind: "ask_learner",
      reason: "step budget spent — finishing the turn",
      source: "fallback",
      durationMs: 0,
    });
    logPlan(session.sessionId, turnIndex, trace);
    return { ...forced, plan: trace };
  }

  /**
   * Execute one planned step. Returns a TurnResult for the terminal steps and
   * null for the preparation steps, which only write to the turn's blackboard.
   */
  private async runStep(step: PlanStep, args: StepArgs): Promise<TurnResult | null> {
    const { topic, snapshot, ctx } = args;

    switch (step.kind) {
      case "read_board":
        ctx.interpretation = await this.vision.interpret(snapshot, args.typedText, topic.title);
        return null;

      case "reuse_board":
        // Same board as last turn: carry the reading over under this turn's
        // snapshot id, and skip the Vision call entirely.
        ctx.interpretation = args.previousTurn
          ? { ...args.previousTurn.interpretation, snapshotId: snapshot.snapshotId }
          : await this.vision.interpret(snapshot, args.typedText, topic.title);
        return null;

      case "verify_board": {
        // A directed second pass at the part Vision was unsure about — the
        // Learner's reread_board tool, turned on Vision's own doubt (§S1).
        const focus =
          step.focus?.trim() ||
          ctx.interpretation?.suggestedClarification ||
          "bagian yang tidak terbaca";
        try {
          const second = await this.vision.interpret(
            snapshot,
            null,
            `${topic.title} — verifikasi baca ulang: ${focus}`,
          );
          ctx.interpretation = betterReading(ctx.interpretation, second);
        } catch (err) {
          console.error("[Orchestrator] verify_board failed:", err);
        }
        return null;
      }

      case "transcribe_audio": {
        if (!this.asr || !args.audio) return null;
        const clip: AudioClip = {
          segmentId: newId("seg"),
          sessionId: args.session.sessionId,
          turnIndex: args.turnIndex,
          audio: args.audio,
          format: "webm",
          capturedAt: utcNowIso(),
        };
        // typedText is the board-channel fallback, so it is NOT fed to ASR (that
        // would duplicate the same text into both channels).
        ctx.speech = await this.asr.transcribe(clip, null, topic.title);
        sessions.saveTranscript(ctx.speech);
        return null;
      }

      case "ask_confirmation":
        // Pause the turn and ask the user to confirm/correct (§5.3).
        return {
          kind: "confirmation",
          interpretation: ctx.interpretation ?? undefined,
          snapshotId: snapshot.snapshotId,
          suggestedClarification: ctx.interpretation?.suggestedClarification,
        };

      case "ask_learner":
        return this.askLearner(args);

      default:
        return null;
    }
  }

  /** The terminal step: the student reacts, and the whole turn is persisted. */
  private async askLearner({
    session,
    topic,
    snapshot,
    typedText,
    turnIndex,
    allowConfirmation,
    ctx,
  }: StepArgs): Promise<TurnResult> {
    const interpretation = bestGuess(
      ctx.interpretation ?? blankInterpretation(snapshot.snapshotId),
      allowConfirmation,
    );
    const speech = ctx.speech;

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

// --- Situation building ----------------------------------------------------

/**
 * Project the turn's state into the flags the Planner reasons over. Rebuilt
 * before every step, so a decision is never made against stale state.
 *
 * Note what is *not* in here (§1.4): no reference material, no key concepts. The
 * Planner schedules work; it has no business holding the answer key.
 */
function buildSituation(
  { turnIndex, audio, typedText, previousTurn, allowConfirmation, ctx, snapshot }: StepArgs,
  stepsLeft: number,
): TurnSituation {
  const hasImage = Boolean(snapshot.image.trim());
  const hasTypedText = Boolean(typedText && typedText.trim());
  const interpretation = ctx.interpretation;

  return {
    turnIndex,
    hasImage,
    hasAudio: Boolean(audio && audio.trim()),
    hasTypedText,
    hasPreviousBoard: Boolean(previousTurn),
    boardUnchanged: isBoardUnchanged({
      image: snapshot.image,
      hasImage,
      hasTypedText,
      previousTurn,
    }),
    completed: [...ctx.completed],
    boardRead: interpretation !== null,
    boardConfidence: interpretation?.confidence ?? null,
    boardNeedsConfirmation: interpretation?.needsConfirmation ?? false,
    boardText: interpretation?.transcribedText ?? "",
    boardClarification: interpretation?.suggestedClarification ?? "",
    audioTranscribed: ctx.speech !== null,
    speechConfidence: ctx.speech?.confidence ?? null,
    allowConfirmation,
    stepsLeft: Math.max(0, stepsLeft),
  };
}

/**
 * Has the board moved on since the previous turn? Two ways it has not: the exact
 * same image came back, or nothing new arrived on the board channel at all (an
 * audio-only turn). Either way the previous reading still describes the board,
 * and re-running Vision would buy nothing.
 */
function isBoardUnchanged({
  image,
  hasImage,
  hasTypedText,
  previousTurn,
}: {
  image: string;
  hasImage: boolean;
  hasTypedText: boolean;
  previousTurn: TeachingTurn | undefined;
}): boolean {
  if (!previousTurn) return false;
  if (hasTypedText) return false; // typed text is new board content by definition
  if (!hasImage) return true; // nothing new arrived on the board channel

  const previousImage = sessions.getSnapshot(previousTurn.snapshotId)?.image;
  if (!previousImage) return false;
  return digest(image) === digest(previousImage);
}

/** Hash rather than compare: board images are megabytes of base64. */
function digest(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

/** Keep whichever of the two readings is more trustworthy, then more complete. */
function betterReading(
  first: VisionInterpretation | null,
  second: VisionInterpretation,
): VisionInterpretation {
  if (!first) return second;
  if (second.confidence > first.confidence) return second;
  if (second.confidence === first.confidence) {
    return second.transcribedText.trim().length > first.transcribedText.trim().length
      ? second
      : first;
  }
  return first;
}

/**
 * When the caller cannot act on a confirmation request, an unsure reading still
 * has to become something the student can react to: keep Vision's best guess, and
 * give it a neutral placeholder when it read nothing at all.
 */
function bestGuess(
  interpretation: VisionInterpretation,
  allowConfirmation: boolean,
): VisionInterpretation {
  if (allowConfirmation || !interpretation.needsConfirmation) return interpretation;
  return {
    ...interpretation,
    transcribedText: interpretation.transcribedText.trim() || FALLBACK_BOARD_TEXT,
    needsConfirmation: false,
  };
}

function blankInterpretation(snapshotId: string): VisionInterpretation {
  return {
    snapshotId,
    transcribedText: "",
    elements: [],
    confidence: 0,
    needsConfirmation: true,
  };
}

function lastTurn(sessionId: string): TeachingTurn | undefined {
  const turns = sessions.listTurns(sessionId);
  return turns.length ? turns[turns.length - 1] : undefined;
}

/** One line per turn: which steps ran, why they were chosen, what they cost (§S8). */
function logPlan(sessionId: string, turnIndex: number, trace: PlanTraceEntry[]): void {
  const steps = trace.map((t) => `${t.kind}(${t.source},${t.durationMs}ms)`).join(" -> ");
  console.log(`[orchestrator] ${sessionId} giliran ${turnIndex}: ${steps}`);
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
 * Construct an Orchestrator. Each agent resolves its own LLM internally (Gemini
 * when a credential is set, otherwise the deterministic mock).
 * `useConfig: false` forces the offline path — used by tests.
 */
export function buildOrchestrator({
  useConfig = true,
}: { useConfig?: boolean } = {}): Orchestrator {
  return new Orchestrator({
    learner: new LearnerAgent({ forceMock: !useConfig }),
    vision: new VisionAgent({ confidenceThreshold: config.VISION_CONFIDENCE_THRESHOLD }),
    asr: new AsrAgent({ confidenceThreshold: config.ASR_CONFIDENCE_THRESHOLD }),
    planner: new PlannerAgent({ useMock: !useConfig }),
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
