import { defaultClarification } from "../shared/clarification.js";
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
    segments: normalizeSegments(raw.segments),
  };
}

/**
 * Keep only segments whose times make sense, in time order.
 *
 * A time the model got wrong would pair a sentence with the wrong drawing, and
 * nothing downstream could tell. So anything that is not a finite, non-negative
 * start with an end no earlier than it is dropped rather than repaired, and
 * empty text goes too: a segment with no words lines nothing up.
 */
export function normalizeSegments(value: unknown): AsrLLMOutput["segments"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      start: s.start,
      end: s.end,
      text: typeof s.text === "string" ? s.text.trim() : "",
    }))
    .filter(
      (s): s is { start: number; end: number; text: string } =>
        typeof s.start === "number" &&
        typeof s.end === "number" &&
        Number.isFinite(s.start) &&
        Number.isFinite(s.end) &&
        s.start >= 0 &&
        s.end >= s.start &&
        s.text.length > 0,
    )
    .sort((a, b) => a.start - b.start);
}

/**
 * Mapping to the official SpeechTranscript contract (§6.5). It now mirrors
 * Vision: the "some part is unclear" signal survives twice over -- as a lowered
 * `confidence` (kept so anything that only reads that number behaves as before)
 * AND as an explicit needsConfirmation + suggestedClarification, which lets the
 * orchestrator actually pause the turn instead of hoping the frontend notices
 * a low number (§3.5, §5.3).
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

  const needsConfirmation =
    confidence < config.ASR_CONFIDENCE_THRESHOLD || output.ambiguities.length > 0;

  return {
    segmentId: input.segmentId,
    sessionId: input.sessionId,
    turnIndex: input.turnIndex,
    transcript: output.transcript,
    audioRef: input.audioRef,
    confidence,
    language: output.language,
    capturedAt: input.capturedAt,
    needsConfirmation,
    suggestedClarification: needsConfirmation
      ? defaultClarification(output.ambiguities, "speech")
      : undefined,
    segments: output.segments.length
      ? output.segments.map((s) => ({
          startMs: Math.round(s.start * 1000),
          endMs: Math.round(s.end * 1000),
          text: s.text,
        }))
      : undefined,
  };
}

/** Safe result when the ASR call fails completely (network, invalid JSON, etc.).
 * Empty transcript + confidence 0 -- the frontend shows an empty channel and the
 * user can retype (§5.3). Never drops the turn, but it does ask for
 * confirmation, the same way Vision's createFallbackInterpretation does. */
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
    needsConfirmation: true,
    suggestedClarification:
      "The audio can't be transcribed right now. Could you type what you said instead?",
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
