import type { WorkspaceDTO } from '../dto/WorkspaceDTO';
import type { TeachingCheckpointDTO } from '../dto/TeachingCheckpointDTO';
import type { ChatMessageDTO } from '../dto/ChatMessageDTO';
import type {
  EvaluationReportDTO,
  EvaluationRoundSummaryDTO,
  ScoreHistoryPointDTO,
} from '../dto/EvaluationReportDTO';
import type { TimelineDTO } from '../dto/TimelineDTO';
import type {
  ReferenceSuggestionsDTO,
  SaveReferenceTextResultDTO,
  UseReferenceResultDTO,
} from '../dto/ReferenceDTO';
import type { Locale } from '../i18n/messages';

export interface CognivaBridge {
  // Home
  listWorkspaces(): Promise<WorkspaceDTO[]>;
  /** `locale` fixes the language of the new session; it cannot be changed later. */
  createWorkspace(locale: Locale): Promise<WorkspaceDTO>;
  deleteWorkspace(workspaceId: string): Promise<void>;

  // Workspace meta
  getWorkspace(workspaceId: string): Promise<WorkspaceDTO>;
  // `locale` is only honoured while the session has not started — the server
  // ignores it afterwards, when the student has already spoken in it.
  updateWorkspaceMeta(
    workspaceId: string,
    meta: { title?: string; description?: string; learnerId?: string; locale?: Locale }
  ): Promise<WorkspaceDTO>;
  uploadWorkspacePdf(workspaceId: string, file: File): Promise<WorkspaceDTO>;

  // Reference material the user writes or pastes in — the third way in, beside
  // an uploaded PDF and a source the agent found. Replaces whatever was there.
  saveReferenceText(workspaceId: string, text: string): Promise<SaveReferenceTextResultDTO>;

  // Reference sourcing — for a user who has no material of their own. Both of
  // these answer when the work is done rather than returning early to be polled:
  // the user is waiting in a dialog, and a search takes seconds, not minutes.
  suggestReferences(workspaceId: string, hint?: string): Promise<ReferenceSuggestionsDTO>;
  // A source that cannot be read resolves with ok:false — that is an outcome the
  // user acts on (pick another), not an error to throw at them.
  useReference(
    workspaceId: string,
    choice: { url: string; title?: string; source?: string }
  ): Promise<UseReferenceResultDTO>;
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
      // When each board change happened relative to the recording (Phase 1:
      // stored, not yet used). Plain JSON, so no encoding step like the Blobs.
      // Optional - absent without a mic, or on the Excalidraw engine.
      timeline?: TimelineDTO;
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
  /** The latest finished round, or an earlier one when `round` is given. */
  getEvaluationReport(workspaceId: string, round?: number): Promise<EvaluationReportDTO>;
  /** Which rounds this workspace has finished, oldest first. */
  getEvaluationRounds(workspaceId: string): Promise<EvaluationRoundSummaryDTO[]>;
  /** Scores of every round this device has finished, oldest first. */
  getScoreHistory(): Promise<ScoreHistoryPointDTO[]>;

  // Resume a session from Completed back to Teaching
  resumeSession(workspaceId: string): Promise<WorkspaceDTO>;
}