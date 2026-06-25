/**
 * ASR agent — real speech-to-text transcription (Architecture Document §3.5).
 *
 * Mirrors VisionAgent: a typed-text fallback channel that needs no model, a
 * no-input path, and a real path that sends the audio clip to the centralized
 * Gemini wrapper. Output is the official SpeechTranscript contract (§6.5).
 *
 * Confirmation note: unlike Vision, SpeechTranscript has no needsConfirmation
 * flag — a low `confidence` is the signal the frontend uses to show the
 * transcript for correction (§3.5, §5.3). See GAPS_ASR.md.
 */

import { runAsrTurn } from "./asr.agent.js";
import type { AudioClip, RunAsrOptions, SpeechTranscript } from "./asr.types.js";

export class AsrAgent {
  readonly confidenceThreshold: number;
  private readonly options: RunAsrOptions;

  constructor({
    confidenceThreshold,
    ...options
  }: { confidenceThreshold: number } & RunAsrOptions) {
    this.confidenceThreshold = confidenceThreshold;
    this.options = options;
  }

  async transcribe(
    clip: AudioClip,
    typedText: string | null | undefined,
    topic = "",
  ): Promise<SpeechTranscript> {
    // Typed-text fallback (§5.3) — no model call: the user already gave us
    // clean text, so transcription is unnecessary.
    if (typedText && typedText.trim()) {
      return {
        segmentId: clip.segmentId,
        sessionId: clip.sessionId,
        turnIndex: clip.turnIndex,
        transcript: typedText.trim(),
        audioRef: clip.audioRef,
        confidence: 1.0,
        language: "id-ID",
        capturedAt: clip.capturedAt,
      };
    }

    // No audio and no typed text: the voice channel is optional, so we return
    // an empty transcript (confidence 0) rather than blocking the turn.
    if (!clip.audio) {
      return {
        segmentId: clip.segmentId,
        sessionId: clip.sessionId,
        turnIndex: clip.turnIndex,
        transcript: "",
        audioRef: clip.audioRef,
        confidence: 0,
        language: "id-ID",
        capturedAt: clip.capturedAt,
      };
    }

    return runAsrTurn(
      {
        segmentId: clip.segmentId,
        sessionId: clip.sessionId,
        turnIndex: clip.turnIndex,
        topic,
        audioBase64: clip.audio,
        mimeType: `audio/${clip.format || "webm"}`,
        capturedAt: clip.capturedAt,
        audioRef: clip.audioRef,
      },
      this.options,
    );
  }
}
