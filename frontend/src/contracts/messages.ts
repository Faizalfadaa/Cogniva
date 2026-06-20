/**
 * Kontrak pesan WebSocket — sisi frontend (Dokumen Arsitektur §7.2).
 * Setiap pesan membawa field `type`. Harus sepadan dengan
 * backend/app/ws/messages.py.
 */

import type {
  LearnerResponse,
  SpeechTranscript,
  VisionInterpretation,
} from "./index";

// Klien -> Server
export interface TeachingInput {
  type: "teaching_input";
  image: string;
  audio?: string;
  typedText?: string;
}

export interface ConfirmationResponse {
  type: "confirmation_response";
  snapshotId: string;
  corrected: string;
}

export interface EndSession {
  type: "end_session";
}

export type ClientMessage =
  | TeachingInput
  | ConfirmationResponse
  | EndSession;

// Server -> Klien
export interface VisionResult {
  type: "vision_result";
  interpretation: VisionInterpretation;
}

export interface SpeechResult {
  type: "speech_result";
  transcript: SpeechTranscript;
}

export interface ConfirmationRequest {
  type: "confirmation_request";
  snapshotId: string;
  suggestedClarification: string;
}

export interface LearnerMessage {
  type: "learner_message";
  response: LearnerResponse;
}

export interface StateUpdate {
  type: "state_update";
  status: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerMessage =
  | VisionResult
  | SpeechResult
  | ConfirmationRequest
  | LearnerMessage
  | StateUpdate
  | ErrorMessage;
