export type WorkspaceState = 'Draft' | 'Teaching' | 'Evaluating' | 'Completed';

import type { ReferenceSourceDTO } from './ReferenceDTO';

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
  createdAt: string;
  updatedAt: string;
}