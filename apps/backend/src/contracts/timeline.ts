/**
 * Audio-visual timeline — when each board change happened relative to the
 * spoken explanation (Phase 1: capture and store only).
 *
 * The teacher draws incrementally while talking, so "this arrow appeared while
 * he said X" is the link between the board and the audio. Phase 1 only records
 * that link; nothing reads it yet (see TeachingCheckpoint.timeline, stored the
 * same way whiteboardSnapshot already is).
 */

import { z } from "zod";

/** One board change, timestamped against the start of the recording. */
export const boardEventSchema = z.object({
  /**
   * Milliseconds since `recordingStartedAt`. Signed on purpose: the canvas is
   * live before the mic is (permission prompt, mic toggled off), so a change
   * made before recording began is legitimately negative rather than invalid.
   */
  at: z.number().int(),
  /** The board shapes this change touched. */
  shapeIds: z.array(z.string()),
  kind: z.enum(["add", "update", "delete"]),
  /**
   * Where in the audio clip this happened, in milliseconds.
   *
   * Not the same as `at` once the mic has been paused: the clip holds only the
   * stretches that were recorded, so wall time after a pause runs ahead of it.
   * Null when the change was made while the mic was off, since no speech in the
   * clip happened at the same moment. Speech segments are timed on this clock.
   */
  audioAt: z.number().int().nullable().optional(),
  /** The kind of element (Excalidraw's type: "text", "arrow", "freedraw"...). */
  shape: z.string().optional(),
  /** The words, when the element is text. */
  text: z.string().optional(),
});
export type BoardEvent = z.infer<typeof boardEventSchema>;

/** All board changes for one checkpoint, plus the clock they are measured from. */
export const timelineSchema = z.object({
  /** ISO-8601 UTC instant the audio recording started — the t=0 of `at`. */
  recordingStartedAt: z.string().datetime(),
  events: z.array(boardEventSchema).default([]),
});
export type Timeline = z.infer<typeof timelineSchema>;
