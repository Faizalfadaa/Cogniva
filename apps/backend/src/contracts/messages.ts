/**
 * WebSocket message contracts (Architecture Document §7.2).
 *
 * The real-time session channel uses WebSocket at /ws/sessions/{id}. Every
 * message carries a `type` field. Client-to-server messages are only processed
 * when the session status allows it (e.g. teaching_input only in TEACHING).
 */

import { z } from "zod";
import { visionInterpretationSchema } from "./board.js";
import { learnerResponseSchema } from "./learner.js";
import { speechTranscriptSchema } from "./speech.js";

// --- Client -> Server ------------------------------------------------------

/** { image, audio?, typedText? } — submit a turn (while TEACHING). */
export const teachingInputSchema = z.object({
  type: z.literal("teaching_input"),
  image: z.string().default(""),
  audio: z.string().nullish(),
  typedText: z.string().nullish(),
});

/** { snapshotId, corrected } — correct an uncertain interpretation. */
export const confirmationResponseSchema = z.object({
  type: z.literal("confirmation_response"),
  snapshotId: z.string().optional(),
  corrected: z.string().nullish(),
});

/** Request to end the session. */
export const endSessionSchema = z.object({
  type: z.literal("end_session"),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  teachingInputSchema,
  confirmationResponseSchema,
  endSessionSchema,
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// --- Server -> Client ------------------------------------------------------

export interface VisionResult {
  type: "vision_result";
  interpretation: z.infer<typeof visionInterpretationSchema>;
}

export interface SpeechResult {
  type: "speech_result";
  transcript: z.infer<typeof speechTranscriptSchema>;
}

export interface ConfirmationRequest {
  type: "confirmation_request";
  snapshotId: string;
  suggestedClarification: string;
  /** Which channel is unsure -- the board reading or the voice transcript.
   * Optional so clients written when only the board could pause still work. */
  source?: "board" | "voice";
}

export interface LearnerMessage {
  type: "learner_message";
  response: z.infer<typeof learnerResponseSchema>;
}

export interface StateUpdate {
  type: "state_update";
  status: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

/** The session hit its token ceiling (§7.3) — distinct from `error` so the UI
 * can explain a budget stop rather than showing it as a failure. */
export interface BudgetExceeded {
  type: "budget_exceeded";
  message: string;
}

export type ServerMessage =
  | VisionResult
  | SpeechResult
  | ConfirmationRequest
  | LearnerMessage
  | StateUpdate
  | ErrorMessage
  | BudgetExceeded;
