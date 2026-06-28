import * as config from "../../config/index.js";
import type { AsrAgentInput, AsrLLMOutput, SpeechTranscript } from "./asr.types.js";

/** Parse keluaran mentah dari LLMClient.structured() (sudah berupa objek JSON,
 * bukan teks) jadi AsrLLMOutput yang aman dipakai -- setiap field
 * divalidasi/diberi default, tidak percaya bentuk dari model begitu saja. */
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
 * Pemetaan ke kontrak resmi SpeechTranscript (§6.5). Tidak lossy seperti Vision:
 * SpeechTranscript memang tidak punya field ambiguities/needsConfirmation, jadi
 * sinyal "ada bagian tak jelas" diturunkan ke nilai `confidence` (frontend
 * menampilkan transkrip untuk dikoreksi bila confidence di bawah ambang -- §3.5,
 * §5.3). Lihat GAPS_ASR.md poin B.
 */
export function toSpeechTranscript(
  output: AsrLLMOutput,
  input: AsrAgentInput,
): SpeechTranscript {
  // Bila model menandai ambiguitas tapi memberi confidence tinggi, turunkan
  // agar sinyal "perlu dicek" tidak hilang saat dipetakan ke kontrak.
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

/** Hasil aman saat panggilan ASR gagal total (network, JSON tak valid, dsb).
 * Transkrip kosong + confidence 0 -- frontend menampilkan kanal kosong dan
 * pengguna bisa mengetik ulang (§5.3). Tidak pernah menjatuhkan giliran. */
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
