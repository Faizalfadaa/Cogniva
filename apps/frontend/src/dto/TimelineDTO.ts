export type BoardEventKind = 'add' | 'update' | 'delete';

/** One board change, timestamped against the start of the audio recording. */
export interface BoardEventDTO {
  /** Milliseconds since `recordingStartedAt`. Negative is legal: the canvas is
   *  live before the mic is, so a change can precede the recording. */
  at: number;
  shapeIds: string[];
  kind: BoardEventKind;
  /** Milliseconds into the audio clip; null when drawn while the mic was off.
   *  Differs from `at` after a pause, since the clip skips the paused stretch. */
  audioAt?: number | null;
  /** Excalidraw's element type ("text", "arrow", "freedraw"...). */
  shape?: string;
  /** The words, when the element is text. */
  text?: string;
}

/** Board changes for one checkpoint, plus the clock they are measured from.
 *  Phase 1: sent and stored only — nothing reads it yet. */
export interface TimelineDTO {
  /** ISO-8601 UTC instant the recording started — the t=0 of every `at`. */
  recordingStartedAt: string;
  events: BoardEventDTO[];
}
