/**
 * Visual channel: BoardSnapshot, Element, VisionInterpretation
 * (Architecture Document §6.3, §6.4).
 *
 * The board snapshot is captured by the frontend, sent to the backend, then
 * Vision turns it into a structured interpretation that becomes the core input
 * for the Learner.
 */

import { z } from "zod";
import { elementTypeSchema } from "./enums.js";

/** A board capture for one turn, sent from frontend to backend (§6.3). */
export const boardSnapshotSchema = z.object({
  snapshotId: z.string(),
  sessionId: z.string(),
  turnIndex: z.number().int(),
  /** Image data as base64 or object URL. */
  image: z.string(),
  format: z.string(),
  capturedAt: z.string(),
});
export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>;

/** A single element detected on the board (§6.4). bbox is optional: [x, y, w, h]. */
export const elementSchema = z.object({
  type: elementTypeSchema,
  content: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export type Element = z.infer<typeof elementSchema>;

/**
 * Vision's output over a snapshot — the core input for the Learner (§6.4).
 *
 * When confidence is below threshold, needsConfirmation is true and Vision
 * includes a suggestedClarification instead of guessing silently (invariant §3.4).
 */
export const visionInterpretationSchema = z.object({
  snapshotId: z.string(),
  transcribedText: z.string(),
  elements: z.array(elementSchema).default([]),
  /** Confidence level 0..1. */
  confidence: z.number(),
  /** true when confidence is below threshold. */
  needsConfirmation: z.boolean(),
  suggestedClarification: z.string().optional(),
});
export type VisionInterpretation = z.infer<typeof visionInterpretationSchema>;
