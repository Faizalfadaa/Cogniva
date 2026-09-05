/**
 * AI agents (Architecture Document §3.4-§3.7).
 *
 * All four agents are live: Vision reads the board, ASR transcribes the voice
 * channel, the Learner role-plays the novice student during the session, and the
 * Evaluator grades the user's explanation once the session ends. Each routes its
 * real call through the centralized Gemini wrapper and falls back gracefully.
 *
 * A fifth agent sits above them: the Planner (§3.3, S5) decides which of the four
 * runs this turn, and in what order. It produces no content of its own — it only
 * schedules, and the Orchestrator executes.
 *
 * A sixth sits outside the turn loop entirely: the Referencer looks up reading
 * material for a user who uploaded none, so the Evaluator has something to grade
 * against. It runs on request, not per turn.
 */

export { LearnerAgent, seedLearnerState, seedLearnerStateFromEvaluation } from "./learner/index.js";
export type { LearnerTools, RespondArgs } from "./learner/index.js";
export { VisionAgent } from "./vision/index.js";
export { PlannerAgent, decideStep, planWithRules, shouldReplan, takeFeasible, isTerminal } from "./planner/index.js";
export type { Plan, PlanStep, PlanStepKind, PlanTraceEntry, TurnSituation } from "./planner/index.js";
export { AsrAgent } from "./asr/index.js";
export { EvaluatorAgent, getEvaluator, setEvaluator, runEvaluator } from "./evaluator/index.js";
export type { EvaluatorInput, TranscriptTurn } from "./evaluator/index.js";
export { ReferencerAgent, fetchReferenceText, suggestReferences } from "./referencer/index.js";
export type {
  FetchedReference,
  ReferenceKind,
  ReferenceOption,
  ReferenceSuggestions,
  SuggestReferencesArgs,
} from "./referencer/index.js";
