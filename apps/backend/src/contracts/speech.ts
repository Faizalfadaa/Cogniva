/**
 * SpeechTranscript — the teacher's transcribed speech for one turn
 * (Architecture Document §6.5).
 *
 * A core input for the Learner and part of the transcript the Evaluator reads.
 * Produced by ASR. When confidence is low, the transcript is shown so the user
 * can correct it (§3.5). It also carries the same explicit "please confirm"
 * pair as VisionInterpretation, so an uncertain voice turn can pause and ask
 * rather than depending on the frontend to notice a low number by itself.
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
  /** true when confidence is below the threshold or the model flagged ambiguity. */
  needsConfirmation: z.boolean().default(false),
  /** The question to ask the teacher when needsConfirmation is true. */
  suggestedClarification: z.string().optional(),
});

export type SpeechTranscript = z.infer<typeof speechTranscriptSchema>;
