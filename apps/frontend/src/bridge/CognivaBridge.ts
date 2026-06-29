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
  // Autosave draft whiteboard selama state Editing - dipanggil berkala (debounced),
  // terpisah dari submitCheckpoint yang hanya jalan saat tombol Teach ditekan.
  // thumbnail (opsional) dipakai sebagai preview kecil di card Home.
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
      // Rekaman penjelasan user selama editing, di-upload utuh bareng snapshot.
      // Optional - mic mungkin tidak aktif/diizinkan.
      audio?: Blob;
    }
  ): Promise<TeachingCheckpointDTO>;
  getCheckpoints(workspaceId: string): Promise<TeachingCheckpointDTO[]>;

  // Chat (polling - dipanggil berkala oleh caller, bukan subscription)
  sendChatMessage(workspaceId: string, content: string): Promise<ChatMessageDTO>;
  getChatMessages(workspaceId: string): Promise<ChatMessageDTO[]>;

  // Evaluation
  // State workspace langsung pindah ke 'Evaluating'; caller poll getWorkspace()
  // untuk tahu kapan berubah jadi 'Completed' - tidak ada endpoint status terpisah.
  finishSession(workspaceId: string): Promise<void>;
  getEvaluationReport(workspaceId: string): Promise<EvaluationReportDTO>;

  // Lanjutkan sesi dari Completed kembali ke Teaching
  resumeSession(workspaceId: string): Promise<WorkspaceDTO>;
}