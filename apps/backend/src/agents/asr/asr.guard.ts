import * as config from "../../config/index.js";
import type { AsrAgentInput, AsrLLMOutput, SpeechTranscript } from "./asr.types.js";

/** Parse the raw output from LLMClient.structured() (already a JSON object, not
 * text) into a safe-to-use AsrLLMOutput -- every field is validated/defaulted,
 * never trusting the model's shape blindly. */
export function normalizeAsrLLMOutput(raw: Record<string, unknown>): AsrLLMOutput {
  const ambiguities = Array.isArray(raw.ambiguities)
    ? raw.ambiguities.filter((a): a is string => typeof a === "string")
    : [];

  return {
    transcript: typeof raw.transcript === "string" ? raw.transcript.trim() : "",
    confidence: clamp01(typeof raw.confidence === "number" ? raw.confidence : 0),
    language:
      typeof raw.language === "string" && raw.language.trim()
        ? raw.language.trim()
        : config.ASR_DEFAULT_LANGUAGE,
    ambiguities,
  };
}

/**
 * Mapping to the official SpeechTranscript contract (§6.5). Not lossy like Vision:
 * SpeechTranscript has no ambiguities/needsConfirmation field, so the "some part
 * is unclear" signal is folded into the `confidence` value (the frontend shows the
 * transcript for correction when confidence is below the threshold -- §3.5, §5.3).
 * See GAPS_ASR.md point B.
 */
export function toSpeechTranscript(
  output: AsrLLMOutput,
  input: AsrAgentInput,
): SpeechTranscript {
  // If the model flags ambiguity but reports high confidence, lower it so the
  // "needs checking" signal isn't lost when mapped to the contract.
  const confidence =
    output.ambiguities.length > 0
      ? Math.min(output.confidence, config.ASR_CONFIDENCE_THRESHOLD)
      : output.confidence;

  return {
    segmentId: input.segmentId,
    sessionId: input.sessionId,
    turnIndex: input.turnIndex,
    transcript: output.transcript,
    audioRef: input.audioRef,
    confidence,
    language: output.language,
    capturedAt: input.capturedAt,
  };
}

/** Safe result when the ASR call fails completely (network, invalid JSON, etc.).
 * Empty transcript + confidence 0 -- the frontend shows an empty channel and the
 * user can retype (§5.3). Never drops the turn. */
export function createFallbackTranscript(input: AsrAgentInput): SpeechTranscript {
  return {
    segmentId: input.segmentId,
    sessionId: input.sessionId,
    turnIndex: input.turnIndex,
    transcript: "",
    audioRef: input.audioRef,
    confidence: 0,
    language: config.ASR_DEFAULT_LANGUAGE,
    capturedAt: input.capturedAt,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
