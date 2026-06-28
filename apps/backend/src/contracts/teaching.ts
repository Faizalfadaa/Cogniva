/**
 * TeachingTurn — a single record of one teaching turn (Architecture Document §6.6).
 *
 * The sequence of these objects forms the transcript. Each turn combines the
 * board channel (snapshot + interpretation) and the voice channel (speech
 * transcript).
 */

import { z } from "zod";
import { visionInterpretationSchema } from "./board.js";
import { speechTranscriptSchema } from "./speech.js";

export const teachingTurnSchema = z.object({
  turnIndex: z.number().int(),
  sessionId: z.string(),
  snapshotId: z.string(),
  interpretation: visionInterpretationSchema,
  speechTranscript: speechTranscriptSchema.optional(),
  typedInput: z.string().nullable().optional(),
  learnerResponseId: z.string(),
  createdAt: z.string(),
});

export type TeachingTurn = z.infer<typeof teachingTurnSchema>;
