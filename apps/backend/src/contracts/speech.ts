/**
 * SpeechTranscript — the teacher's transcribed speech for one turn
 * (Architecture Document §6.5).
 *
 * A core input for the Learner and part of the transcript the Evaluator reads.
 * Produced by ASR. When confidence is low, the transcript is shown so the user
 * can correct it (§3.5).
 */

import { z } from "zod";

export const speechTranscriptSchema = z.object({
  segmentId: z.string(),
  sessionId: z.string(),
  turnIndex: z.number().int(),
  transcript: z.string(),
  audioRef: z.string().optional(),
  /** ASR confidence level 0..1. */
  confidence: z.number(),
  /** Language code, e.g. "en-US". */
  language: z.string(),
  capturedAt: z.string(),
});

export type SpeechTranscript = z.infer<typeof speechTranscriptSchema>;
