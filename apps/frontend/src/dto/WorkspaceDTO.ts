export type WorkspaceState = 'Draft' | 'Teaching' | 'Evaluating' | 'Completed';

import type { ReferenceSourceDTO } from './ReferenceDTO';
import type { Locale } from '../i18n/messages';

export interface WorkspaceDTO {
  id: string;
  title?: string;
  description?: string;
  pdfUrl?: string;
  /**
   * Set when the reference material came from a web source the Referencer found
   * instead of an uploaded PDF. The two are mutually exclusive — uploading a PDF
   * clears this.
   */
  referenceSource?: ReferenceSourceDTO;
  state: WorkspaceState;
  /**
   * Snapshot di-autosave selama state Editing.
   * Note this differs from TeachingCheckpointDTO.whiteboardSnapshot,
   * which is the history each time the Teach button is pressed.
   */
  currentWhiteboardSnapshot?: unknown;
  /** Small raster thumbnail of the whiteboard, used as a preview on the Home card */
  thumbnailUrl?: string;
  /**
   * The student picked for this workspace ('yuzuki' | 'reina' | 'akira').
   *
   * On the wire because the backend speaks the learner's replies in that
   * character's voice and cannot read this browser's localStorage. Absent on
   * workspaces made before the picker existed.
   */
  learnerId?: string;
  /**
   * The language this session runs in, fixed when the workspace was created.
   *
   * Server-side rather than in localStorage because it labels every card on the
   * Home grid and has to be right on another device too — the same reason
   * learnerId moved onto the wire.
   */
  locale: Locale;
  createdAt: string;
  updatedAt: string;
}