export type WorkspaceState = 'Draft' | 'Teaching' | 'Evaluating' | 'Completed';

export interface WorkspaceDTO {
  id: string;
  title?: string;
  description?: string;
  pdfUrl?: string;
  state: WorkspaceState;
  /**
   * Snapshot di-autosave selama state Editing.
   * Ini beda yaa dari TeachingCheckpointDTO.whiteboardSnapshot
   * yang merupakan histori tiap kali tombol Teach ditekan.
   */
  currentWhiteboardSnapshot?: unknown;
  /** Thumbnail raster kecil dari whiteboard, dipakai sebagai preview di card Home */
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}