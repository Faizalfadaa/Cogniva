import type { TimelineDTO } from './TimelineDTO';

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
  /** Set when the turn ended in a handled condition (e.g. the session ran out of
   *  token budget) rather than a real reply. `learnerResponse` still carries
   *  readable text, so ignoring this field degrades gracefully. */
  errorKind?: 'budget_exceeded';
  /** When each board change happened relative to the recording (Phase 1).
   *  Absent on older checkpoints and on clients that can't capture it. */
  timeline?: TimelineDTO;
  createdAt: string;
}