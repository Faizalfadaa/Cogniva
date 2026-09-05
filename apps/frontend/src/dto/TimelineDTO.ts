export type BoardEventKind = 'add' | 'update' | 'delete';

/** One board change, timestamped against the start of the audio recording. */
export interface BoardEventDTO {
  /** Milliseconds since `recordingStartedAt`. Negative is legal: the canvas is
   *  live before the mic is, so a change can precede the recording. */
  at: number;
  shapeIds: string[];
  kind: BoardEventKind;
}

/** Board changes for one checkpoint, plus the clock they are measured from.
 *  Phase 1: sent and stored only — nothing reads it yet. */
export interface TimelineDTO {
  /** ISO-8601 UTC instant the recording started — the t=0 of every `at`. */
  recordingStartedAt: string;
  events: BoardEventDTO[];
}
