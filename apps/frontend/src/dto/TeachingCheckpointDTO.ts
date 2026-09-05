export interface TeachingCheckpointDTO {
  id: string;
  /** Snapshot image of the canvas, sent to Vision when the Teach button is pressed */
  snapshotImageUrl: string;
  /** The tldraw document snapshot (JSON) so the whiteboard can be restored exactly */
  whiteboardSnapshot: unknown;
  /** URL of the user's spoken-explanation audio recorded during editing, uploaded with the Teach press */
  audioUrl?: string;
  /** Respon learner setelah Vision + agent memproses snapshot. Kosong selagi diproses. */
  learnerResponse?: string;
  /** Endpoint URL of the spoken learner response (XTTS). Absent when voice is off. */
  learnerAudioUrl?: string;
  createdAt: string;
}