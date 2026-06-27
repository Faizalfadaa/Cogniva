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
  createdAt: string;
  updatedAt: string;
}