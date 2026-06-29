/**
 * AI agents (Architecture Document §3.4-§3.7).
 *
 * All four agents are live: Vision reads the board, ASR transcribes the voice
 * channel, the Learner role-plays the novice student during the session, and the
 * Evaluator grades the user's explanation once the session ends. Each routes its
 * real call through the centralized Gemini wrapper and falls back gracefully.
 */

export { LearnerAgent, seedLearnerState } from "./learner/index.js";
export type { LearnerTools, RespondArgs } from "./learner/index.js";
export { VisionAgent } from "./vision/index.js";
export { AsrAgent } from "./asr/index.js";
export { EvaluatorAgent, getEvaluator, setEvaluator, runEvaluator } from "./evaluator/index.js";
export type { EvaluatorInput, TranscriptTurn } from "./evaluator/index.js";
