import type { SpeechTranscript } from "../../contracts/speech.js";

/**
 * The richer shape requested from the model -- transcript, confidence, detected
 * language code, and explicit ambiguities. Still more detailed than the official
 * SpeechTranscript: the contract has no `ambiguities` list, so the individual
 * reasons are folded into a single suggestedClarification when mapped
 * (see toSpeechTranscript in asr.guard.ts).
 */
export type AsrLLMOutput = {
  transcript: string;
  confidence: number;
  /** BCP-47 language code detected by the model, e.g. "en-US". */
  language: string;
  ambiguities: string[];
};

/**
 * A single turn's audio clip. There is no official contract for this
 * (teaching_input only carries base64 `audio`); sessionId/turnIndex/capturedAt
 * are filled by the orchestrator from session context. See GAPS_ASR.md for a
 * proposed official contract.
 */
export type AudioClip = {
  segmentId: string;
  sessionId: string;
  turnIndex: number;
  /** Base64 (no data: prefix) or an empty string when there's no audio. */
  audio: string;
  /** Container format, e.g. "webm" / "wav" / "mp3". */
  format: string;
  capturedAt: string;
  /** Optional storage reference for the clip, passed through to audioRef. */
  audioRef?: string;
};

export type AsrAgentInput = {
  segmentId: string;
  sessionId: string;
  turnIndex: number;
  topic: string;
  /** Base64 (no data: prefix) or an empty string when there's no audio. */
  audioBase64: string;
  mimeType: string;
  capturedAt: string;
  audioRef?: string;
};

export type RunAsrOptions = {
  /** Force mock mode (used by tests and offline demos). */
  useMock?: boolean;
  /**
   * Reports this turn's token cost back to the orchestrator (§7.3). Optional:
   * agents run exactly as before when nobody is counting.
   */
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
};

export { type SpeechTranscript };
