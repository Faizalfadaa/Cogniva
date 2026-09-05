/**
 * The workspace store singleton, plus the in-memory double the tests use.
 *
 * Storage is Postgres (src/database/stores/prismaWorkspaceStore.ts); see the
 * header of ../storage/sessionStore.ts for why a Map-based implementation still
 * lives alongside it.
 */

import { randomUUID } from "node:crypto";

import type {
  ChatMessage,
  EvaluationReport,
  ReferenceSource,
  TeachingCheckpoint,
  Workspace,
} from "../../contracts/workspace.js";
import { PrismaWorkspaceStore } from "../../database/stores/prismaWorkspaceStore.js";
import type { ReferenceIndex } from "../retrieval/index.js";
import { usingMemoryStore } from "../storage/mode.js";
import type { StoredBlob, WorkspaceStore } from "../storage/types.js";

export type { StoredBlob, WorkspaceStore } from "../storage/types.js";

/** Generate a workspace id, e.g. "ws_1a2b3c4d". */
export function newWorkspaceId(): string {
  return `ws_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/** Test double: the same contract, held in Maps. See the file header. */
export class MemoryWorkspaceStore implements WorkspaceStore {
  private workspaces = new Map<string, Workspace>();
  private sessionIdByWorkspace = new Map<string, string>();
  private checkpoints = new Map<string, TeachingCheckpoint[]>();
  private messages = new Map<string, ChatMessage[]>();
  private reports = new Map<string, EvaluationReport>();
  private pdfs = new Map<string, StoredBlob>();
  private references = new Map<string, string>();
  private referenceSources = new Map<string, ReferenceSource>();
  private referenceIndexes = new Map<string, ReferenceIndex>();
  /** Synthesized learner speech, keyed by audio id and served by URL so the
   * polled checkpoint/message lists stay small. */
  private audioClips = new Map<string, StoredBlob>();
  private owners = new Map<string, string>();

  // --- Workspaces -------------------------------------------------------

  async create(workspace: Workspace, ownerId: string, sessionId: string): Promise<Workspace> {
    this.owners.set(workspace.id, ownerId);
    this.sessionIdByWorkspace.set(workspace.id, sessionId);
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  async save(workspace: Workspace): Promise<Workspace> {
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  async get(id: string): Promise<Workspace | undefined> {
    return this.workspaces.get(id);
  }

  async isOwner(id: string, ownerId: string): Promise<boolean> {
    return this.workspaces.has(id) && this.owners.get(id) === ownerId;
  }

  async list(ownerId: string): Promise<Workspace[]> {
    return [...this.workspaces.values()]
      .filter((w) => this.owners.get(w.id) === ownerId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async delete(id: string): Promise<void> {
    this.workspaces.delete(id);
    this.sessionIdByWorkspace.delete(id);
    this.checkpoints.delete(id);
    this.messages.delete(id);
    this.reports.delete(id);
    this.pdfs.delete(id);
    this.references.delete(id);
    this.referenceIndexes.delete(id);
    this.deleteAudioClips(id);
    this.owners.delete(id);
  }

  async sessionId(workspaceId: string): Promise<string | undefined> {
    return this.sessionIdByWorkspace.get(workspaceId);
  }

  // --- Checkpoints ------------------------------------------------------

  async addCheckpoint(
    workspaceId: string,
    checkpoint: TeachingCheckpoint,
  ): Promise<TeachingCheckpoint> {
    const list = this.checkpoints.get(workspaceId) ?? [];
    list.push(checkpoint);
    this.checkpoints.set(workspaceId, list);
    return checkpoint;
  }

  async listCheckpoints(workspaceId: string): Promise<TeachingCheckpoint[]> {
    return [...(this.checkpoints.get(workspaceId) ?? [])];
  }

  async updateCheckpoint(
    workspaceId: string,
    checkpointId: string,
    patch: Partial<TeachingCheckpoint>,
  ): Promise<void> {
    const list = this.checkpoints.get(workspaceId);
    if (!list) return;
    const idx = list.findIndex((c) => c.id === checkpointId);
    if (idx !== -1) list[idx] = { ...list[idx], ...patch };
  }

  // --- Chat messages ----------------------------------------------------

  async addMessage(workspaceId: string, message: ChatMessage): Promise<ChatMessage> {
    const list = this.messages.get(workspaceId) ?? [];
    list.push(message);
    this.messages.set(workspaceId, list);
    return message;
  }

  /**
   * Patch a message after it was published — used to attach the learner's
   * synthesized voice, which arrives long after the text (§TTS).
   */
  async updateMessage(
    workspaceId: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ): Promise<ChatMessage | undefined> {
    const message = this.messages.get(workspaceId)?.find((m) => m.id === messageId);
    if (!message) return undefined;
    Object.assign(message, patch);
    return message;
  }

  async listMessages(workspaceId: string): Promise<ChatMessage[]> {
    return [...(this.messages.get(workspaceId) ?? [])];
  }

  // --- Evaluation report ------------------------------------------------

  async saveReport(workspaceId: string, report: EvaluationReport): Promise<EvaluationReport> {
    this.reports.set(workspaceId, report);
    return report;
  }

  async getReport(workspaceId: string): Promise<EvaluationReport | undefined> {
    return this.reports.get(workspaceId);
  }

  // --- PDF blob ---------------------------------------------------------

  async savePdf(workspaceId: string, blob: StoredBlob): Promise<void> {
    this.pdfs.set(workspaceId, blob);
  }

  async getPdf(workspaceId: string): Promise<StoredBlob | undefined> {
    return this.pdfs.get(workspaceId);
  }

  // --- Reference material -----------------------------------------------

  async saveReference(workspaceId: string, text: string): Promise<void> {
    this.references.set(workspaceId, text);
  }

  async getReference(workspaceId: string): Promise<string | undefined> {
    return this.references.get(workspaceId);
  }

  async saveReferenceSource(
    workspaceId: string,
    source: ReferenceSource | undefined,
  ): Promise<void> {
    if (source) this.referenceSources.set(workspaceId, source);
    else this.referenceSources.delete(workspaceId);
  }

  async getReferenceSource(workspaceId: string): Promise<ReferenceSource | undefined> {
    return this.referenceSources.get(workspaceId);
  }

  // --- Reference index --------------------------------------------------

  async saveReferenceIndex(workspaceId: string, index: ReferenceIndex): Promise<void> {
    this.referenceIndexes.set(workspaceId, index);
  }

  async getReferenceIndex(workspaceId: string): Promise<ReferenceIndex | undefined> {
    return this.referenceIndexes.get(workspaceId);
  }

  // --- Synthesized learner speech (§TTS) ---------------------------------

  async saveAudioClip(workspaceId: string, audioId: string, blob: StoredBlob): Promise<void> {
    this.audioClips.set(audioKey(workspaceId, audioId), blob);
  }

  async getAudioClip(workspaceId: string, audioId: string): Promise<StoredBlob | undefined> {
    return this.audioClips.get(audioKey(workspaceId, audioId));
  }

  /** Drop every clip belonging to a workspace (called on delete). */
  private deleteAudioClips(workspaceId: string): void {
    const prefix = `${workspaceId}:`;
    for (const key of this.audioClips.keys()) {
      if (key.startsWith(prefix)) this.audioClips.delete(key);
    }
  }
}

/** Clips are namespaced by workspace so one device can never read another's. */
function audioKey(workspaceId: string, audioId: string): string {
  return `${workspaceId}:${audioId}`;
}

/** The store the whole backend writes through. */
export const workspaces: WorkspaceStore = usingMemoryStore()
  ? new MemoryWorkspaceStore()
  : new PrismaWorkspaceStore();
