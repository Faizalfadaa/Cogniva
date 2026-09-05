/**
 * In-memory store for workspaces and everything the UI reads back (§8 placeholder).
 *
 * Mirrors the lightweight, restart-volatile approach of the session store. Each
 * workspace links to an underlying Session (held in the session store) via
 * `sessionId`, so the teaching turns and evaluations live in one place and the
 * Evaluator reads them unchanged.
 */

import { randomUUID } from "node:crypto";

import type {
  ChatMessage,
  EvaluationReport,
  TeachingCheckpoint,
  Workspace,
} from "../../contracts/workspace.js";
import type { ReferenceIndex } from "../retrieval/index.js";

/** A stored binary blob (PDF) we serve back through a GET endpoint. */
export interface StoredBlob {
  data: Buffer;
  mime: string;
}

export class WorkspaceStore {
  private workspaces = new Map<string, Workspace>();
  private sessionIdByWorkspace = new Map<string, string>();
  private checkpoints = new Map<string, TeachingCheckpoint[]>();
  private messages = new Map<string, ChatMessage[]>();
  private reports = new Map<string, EvaluationReport>();
  private pdfs = new Map<string, StoredBlob>();
  private references = new Map<string, string>();
  /** Chunked + embedded reference, built once per upload and searched at
   * evaluation time (§3.7 retrieval). Volatile like everything else here. */
  private referenceIndexes = new Map<string, ReferenceIndex>();
  /** Synthesized learner speech, keyed by audio id and served by URL so the
   * polled checkpoint/message lists stay small. */
  private audioClips = new Map<string, StoredBlob>();
  // Per-device ownership: which client (x-client-id) created each workspace, so
  // one device only ever sees/touches its own. There's no user accounts in the
  // skeleton — a device id stands in for "who". (§8 placeholder isolation.)
  private owners = new Map<string, string>();

  // --- Workspaces -------------------------------------------------------

  save(workspace: Workspace): Workspace {
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  get(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  /** Record the owning device for a workspace (called once, at creation). */
  setOwner(id: string, ownerId: string): void {
    this.owners.set(id, ownerId);
  }

  /** True when `ownerId` owns an existing workspace `id`. */
  isOwner(id: string, ownerId: string): boolean {
    return this.workspaces.has(id) && this.owners.get(id) === ownerId;
  }

  /** This device's workspaces, most-recently-updated first (Home grid order). */
  list(ownerId: string): Workspace[] {
    return [...this.workspaces.values()]
      .filter((w) => this.owners.get(w.id) === ownerId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  delete(id: string): void {
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

  // --- Workspace -> Session link ----------------------------------------

  linkSession(workspaceId: string, sessionId: string): void {
    this.sessionIdByWorkspace.set(workspaceId, sessionId);
  }

  sessionId(workspaceId: string): string | undefined {
    return this.sessionIdByWorkspace.get(workspaceId);
  }

  // --- Checkpoints ------------------------------------------------------

  addCheckpoint(workspaceId: string, checkpoint: TeachingCheckpoint): TeachingCheckpoint {
    const list = this.checkpoints.get(workspaceId) ?? [];
    list.push(checkpoint);
    this.checkpoints.set(workspaceId, list);
    return checkpoint;
  }

  listCheckpoints(workspaceId: string): TeachingCheckpoint[] {
    return [...(this.checkpoints.get(workspaceId) ?? [])];
  }

  updateCheckpoint(
    workspaceId: string,
    checkpointId: string,
    patch: Partial<TeachingCheckpoint>,
  ): void {
    const list = this.checkpoints.get(workspaceId);
    if (!list) return;
    const idx = list.findIndex((c) => c.id === checkpointId);
    if (idx !== -1) list[idx] = { ...list[idx], ...patch };
  }

  // --- Chat messages ----------------------------------------------------

  addMessage(workspaceId: string, message: ChatMessage): ChatMessage {
    const list = this.messages.get(workspaceId) ?? [];
    list.push(message);
    this.messages.set(workspaceId, list);
    return message;
  }

  /**
   * Patch a message after it was published — used to attach the learner's
   * synthesized voice, which arrives seconds after the text (§TTS).
   */
  updateMessage(
    workspaceId: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ): ChatMessage | undefined {
    const message = this.messages.get(workspaceId)?.find((m) => m.id === messageId);
    if (!message) return undefined;
    Object.assign(message, patch);
    return message;
  }

  listMessages(workspaceId: string): ChatMessage[] {
    return [...(this.messages.get(workspaceId) ?? [])];
  }

  // --- Evaluation report ------------------------------------------------

  saveReport(workspaceId: string, report: EvaluationReport): EvaluationReport {
    this.reports.set(workspaceId, report);
    return report;
  }

  getReport(workspaceId: string): EvaluationReport | undefined {
    return this.reports.get(workspaceId);
  }

  // --- PDF blobs --------------------------------------------------------

  savePdf(workspaceId: string, blob: StoredBlob): void {
    this.pdfs.set(workspaceId, blob);
  }

  getPdf(workspaceId: string): StoredBlob | undefined {
    return this.pdfs.get(workspaceId);
  }

  // --- Reference material (text extracted from the uploaded PDF) ---------
  // Read only by the Evaluator as the answer key (§1.4); never by the Learner.

  saveReference(workspaceId: string, text: string): void {
    this.references.set(workspaceId, text);
  }

  getReference(workspaceId: string): string | undefined {
    return this.references.get(workspaceId);
  }

  // --- Reference index (chunked/embedded reference, §3.7 retrieval) -------

  saveReferenceIndex(workspaceId: string, index: ReferenceIndex): void {
    this.referenceIndexes.set(workspaceId, index);
  }

  getReferenceIndex(workspaceId: string): ReferenceIndex | undefined {
    return this.referenceIndexes.get(workspaceId);
  }

  // --- Synthesized learner speech (§TTS) ---------------------------------

  /** Store one rendered clip and return the id it is served under. */
  saveAudioClip(workspaceId: string, audioId: string, blob: StoredBlob): void {
    this.audioClips.set(audioKey(workspaceId, audioId), blob);
  }

  getAudioClip(workspaceId: string, audioId: string): StoredBlob | undefined {
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

/** Generate a workspace id, e.g. "ws_1a2b3c4d". */
export function newWorkspaceId(): string {
  return `ws_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/** Singleton store for the skeleton. */
export const workspaces = new WorkspaceStore();
