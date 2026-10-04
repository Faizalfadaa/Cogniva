/**
 * Planner types (Architecture Document §3.3; solusi S5 in the agentic roadmap).
 *
 * The Orchestrator used to run a hardcoded Vision -> ASR -> Learner pipeline. The
 * Planner replaces that fixed order with a decision: given what actually arrived
 * this turn (image? audio? did the board change? was the reading confident?), it
 * picks the next step and can re-plan when a step surprises it.
 *
 * INVARIANT (§1.4): the Planner sees the *shape* of the turn — flags, confidences
 * and a short excerpt of what the board says — never the reference material. It
 * schedules work; it does not teach, and it does not hold the answer key.
 */

/** Every step the Planner is allowed to schedule. */
export const PLAN_STEP_KINDS = [
  /** Run Vision over this turn's snapshot. */
  "read_board",
  /** Board is unchanged since the last turn — carry that reading over, skip Vision. */
  "reuse_board",
  /** Second, directed Vision pass over a low-confidence reading. */
  "verify_board",
  /** Run ASR over this turn's audio clip. */
  "transcribe_audio",
  /** Terminal: hand everything to the Learner and let the student react. */
  "ask_learner",
  /** Terminal: pause and ask the user to confirm/correct the board reading (§5.3). */
  "ask_confirmation",
] as const;

export type PlanStepKind = (typeof PLAN_STEP_KINDS)[number];

/** The two steps that end a turn. Every plan must reach exactly one of them. */
export const TERMINAL_STEPS: readonly PlanStepKind[] = ["ask_learner", "ask_confirmation"];

export function isTerminal(kind: PlanStepKind): boolean {
  return TERMINAL_STEPS.includes(kind);
}

export interface PlanStep {
  kind: PlanStepKind;
  /** Why this step was chosen. Developer-facing: it lands in the trace, not the UI. */
  reason: string;
  /** verify_board: which part of the board to look at again. */
  focus?: string;
}

/** Where a plan came from — the model, or the deterministic rule engine. */
export type PlanSource = "llm" | "rules";

export interface Plan {
  steps: PlanStep[];
  source: PlanSource;
  rationale: string;
}

/**
 * What the Planner knows when it decides. This is the turn's blackboard in
 * read-only form (§S6, in miniature): the Orchestrator rebuilds it after every
 * executed step, so each decision is made against the current state rather than
 * against the plan's assumptions.
 */
export interface TurnSituation {
  turnIndex: number;

  // --- what the user sent this turn ---
  hasImage: boolean;
  hasAudio: boolean;
  hasTypedText: boolean;

  // --- what earlier turns left behind ---
  /** A previous turn's board reading exists and could be carried over. */
  hasPreviousBoard: boolean;
  /** The board is byte-identical to the previous turn's (or nothing new arrived). */
  boardUnchanged: boolean;

  // --- what has already happened this turn ---
  /** Steps already executed; each kind runs at most once per turn. */
  completed: PlanStepKind[];
  boardRead: boolean;
  boardConfidence: number | null;
  boardNeedsConfirmation: boolean;
  /** Short excerpt of the board reading, so the model can judge substance. */
  boardText: string;
  /** Vision's own suggestion for what to clarify — the default verify focus. */
  boardClarification: string;
  audioTranscribed: boolean;
  speechConfidence: number | null;

  // --- constraints ---
  /** False on the workspace path: that UI has no confirmation step (§K1). */
  allowConfirmation: boolean;
  /** Steps left in this turn's budget (§S8). */
  stepsLeft: number;
}

/** One executed step, kept for the per-turn trace (§S8). */
export interface PlanTraceEntry {
  kind: PlanStepKind;
  reason: string;
  /** "fallback" = the plan ran dry and the rule engine decided on the spot. */
  source: PlanSource | "fallback";
  durationMs: number;
}

/** Raw model output, before the guard gets to it. */
export type PlannerLLMOutput = {
  steps?: Array<{ kind?: string; reason?: string; focus?: string }>;
  rationale?: string;
};

export type RunPlannerOptions = {
  /** Force the deterministic rule engine (tests, offline demos). */
  useMock?: boolean;
};
