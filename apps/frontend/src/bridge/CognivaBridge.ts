import type { WorkspaceDTO } from '../dto/WorkspaceDTO';
import type { TeachingCheckpointDTO } from '../dto/TeachingCheckpointDTO';
import type { ChatMessageDTO } from '../dto/ChatMessageDTO';
import type { EvaluationReportDTO } from '../dto/EvaluationReportDTO';

export interface CognivaBridge {
  // Home
  listWorkspaces(): Promise<WorkspaceDTO[]>;
  createWorkspace(): Promise<WorkspaceDTO>;

  // Workspace meta
  getWorkspace(workspaceId: string): Promise<WorkspaceDTO>;
  updateWorkspaceMeta(
    workspaceId: string,
    meta: { title?: string; description?: string }
  ): Promise<WorkspaceDTO>;
  uploadWorkspacePdf(workspaceId: string, file: File): Promise<WorkspaceDTO>;
  // Autosaves the draft whiteboard during the Editing state - called periodically
  // (debounced), separate from submitCheckpoint which only runs when the Teach
  // button is pressed. The (optional) thumbnail is used as a small preview on the Home card.
  saveWhiteboardDraft(
    workspaceId: string,
    payload: { snapshot: unknown; thumbnail?: Blob }
  ): Promise<WorkspaceDTO>;

  // Teaching session
  submitCheckpoint(
    workspaceId: string,
    payload: {
      snapshotImage: Blob;
      whiteboardSnapshot: unknown;
      // The user's explanation recorded during editing, uploaded whole with the snapshot.
      // Optional - the mic may be off or not permitted.
      audio?: Blob;
    }
  ): Promise<TeachingCheckpointDTO>;
  getCheckpoints(workspaceId: string): Promise<TeachingCheckpointDTO[]>;

  // Chat (polling - called periodically by the caller, not a subscription)
  sendChatMessage(workspaceId: string, content: string): Promise<ChatMessageDTO>;
  getChatMessages(workspaceId: string): Promise<ChatMessageDTO[]>;

  // Evaluation
  // The workspace state moves straight to 'Evaluating'; the caller polls getWorkspace()
  // to learn when it becomes 'Completed' - there's no separate status endpoint.
  finishSession(workspaceId: string): Promise<void>;
  getEvaluationReport(workspaceId: string): Promise<EvaluationReportDTO>;

  // Resume a session from Completed back to Teaching
  resumeSession(workspaceId: string): Promise<WorkspaceDTO>;
}