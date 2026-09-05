/**
 * Postgres-backed WorkspaceStore (Architecture Document §8).
 *
 * Ownership note: there are no user accounts yet, so the frontend's per-device
 * `x-client-id` is the owner. The FK to `users` is real, so a device is
 * provisioned as a user row the first time it creates a workspace — which is
 * also the seam where real accounts will slot in later without touching this
 * store's callers.
 */

import { randomUUID } from "node:crypto";

import type {
  ChatMessage,
  ChatSender,
  EvaluationReport,
  TeachingCheckpoint,
  Workspace,
  WorkspaceState,
} from "../../contracts/workspace.js";
import type { Timeline } from "../../contracts/timeline.js";
import {
  ReferenceIndex,
  type SerializedReferenceIndex,
} from "../../modules/retrieval/index.js";
import type { StoredBlob, WorkspaceStore } from "../../modules/storage/types.js";
import { Prisma, type workspace as WorkspaceRow } from "../../generated/prisma/client";
import { prisma } from "../prisma.js";

export class PrismaWorkspaceStore implements WorkspaceStore {
  // --- Workspaces -------------------------------------------------------

  async create(
    workspace: Workspace,
    ownerId: string,
    sessionId: string,
  ): Promise<Workspace> {
    await ensureOwner(ownerId);
    await prisma.workspace.create({
      data: {
        id_workspace: workspace.id,
        id_user: ownerId,
        id_session: sessionId,
        title: workspace.title ?? null,
        description: workspace.description ?? null,
        state: workspace.state,
        created_at: new Date(workspace.createdAt),
        updated_at: new Date(workspace.updatedAt),
      },
    });
    return workspace;
  }

  async save(workspace: Workspace): Promise<Workspace> {
    // Only the mutable metadata: the owner and the backing session are set once,
    // by create(), and the PDF / reference columns have their own writers.
    await prisma.workspace.updateMany({
      where: { id_workspace: workspace.id },
      data: {
        title: workspace.title ?? null,
        description: workspace.description ?? null,
        state: workspace.state,
        whiteboard_snapshot: toJson(workspace.currentWhiteboardSnapshot),
        thumbnail_url: workspace.thumbnailUrl ?? null,
        updated_at: new Date(workspace.updatedAt),
      },
    });
    return workspace;
  }

  async get(id: string): Promise<Workspace | undefined> {
    const row = await prisma.workspace.findUnique({ where: { id_workspace: id } });
    return row ? toWorkspace(row) : undefined;
  }

  async isOwner(id: string, ownerId: string): Promise<boolean> {
    const row = await prisma.workspace.findFirst({
      where: { id_workspace: id, id_user: ownerId },
      select: { id_workspace: true },
    });
    return row !== null;
  }

  async list(ownerId: string): Promise<Workspace[]> {
    const rows = await prisma.workspace.findMany({
      where: { id_user: ownerId },
      orderBy: { updated_at: "desc" },
    });
    return rows.map(toWorkspace);
  }

  async delete(id: string): Promise<void> {
    // Checkpoints, messages and the report cascade from this row.
    await prisma.workspace.deleteMany({ where: { id_workspace: id } });
  }

  async sessionId(workspaceId: string): Promise<string | undefined> {
    const row = await prisma.workspace.findUnique({
      where: { id_workspace: workspaceId },
      select: { id_session: true },
    });
    return row?.id_session;
  }

  // --- Checkpoints ------------------------------------------------------

  async addCheckpoint(
    workspaceId: string,
    checkpoint: TeachingCheckpoint,
  ): Promise<TeachingCheckpoint> {
    await prisma.checkpoint.create({
      data: {
        id_checkpoint: checkpoint.id,
        id_workspace: workspaceId,
        snapshot_image_url: checkpoint.snapshotImageUrl,
        whiteboard_snapshot: toJson(checkpoint.whiteboardSnapshot),
        audio_url: checkpoint.audioUrl ?? null,
        learner_response: checkpoint.learnerResponse ?? null,
        timeline: toJson(checkpoint.timeline),
        created_at: new Date(checkpoint.createdAt),
      },
    });
    return checkpoint;
  }

  async listCheckpoints(workspaceId: string): Promise<TeachingCheckpoint[]> {
    const rows = await prisma.checkpoint.findMany({
      where: { id_workspace: workspaceId },
      orderBy: { seq: "asc" },
    });
    return rows.map((row) => ({
      id: row.id_checkpoint,
      snapshotImageUrl: row.snapshot_image_url,
      whiteboardSnapshot: row.whiteboard_snapshot ?? undefined,
      audioUrl: row.audio_url ?? undefined,
      learnerResponse: row.learner_response ?? undefined,
      timeline: (row.timeline as Timeline | null) ?? undefined,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async updateCheckpoint(
    workspaceId: string,
    checkpointId: string,
    patch: Partial<TeachingCheckpoint>,
  ): Promise<void> {
    const data: Prisma.checkpointUncheckedUpdateManyInput = {};
    if (patch.snapshotImageUrl !== undefined) data.snapshot_image_url = patch.snapshotImageUrl;
    if ("whiteboardSnapshot" in patch) data.whiteboard_snapshot = toJson(patch.whiteboardSnapshot);
    if ("audioUrl" in patch) data.audio_url = patch.audioUrl ?? null;
    if ("learnerResponse" in patch) data.learner_response = patch.learnerResponse ?? null;
    if ("timeline" in patch) data.timeline = toJson(patch.timeline);
    if (patch.createdAt !== undefined) data.created_at = new Date(patch.createdAt);
    if (Object.keys(data).length === 0) return;

    // Scoped by workspace as well as id, mirroring the in-memory store: a
    // checkpoint id from another workspace must not match.
    await prisma.checkpoint.updateMany({
      where: { id_checkpoint: checkpointId, id_workspace: workspaceId },
      data,
    });
  }

  // --- Chat messages ----------------------------------------------------

  async addMessage(workspaceId: string, message: ChatMessage): Promise<ChatMessage> {
    await prisma.chat_message.create({
      data: {
        id_chat: message.id,
        id_workspace: workspaceId,
        sender: message.sender,
        content: message.content,
        created_at: new Date(message.createdAt),
      },
    });
    return message;
  }

  async listMessages(workspaceId: string): Promise<ChatMessage[]> {
    const rows = await prisma.chat_message.findMany({
      where: { id_workspace: workspaceId },
      orderBy: { seq: "asc" },
    });
    return rows.map((row) => ({
      id: row.id_chat,
      sender: row.sender as ChatSender,
      content: row.content,
      createdAt: row.created_at.toISOString(),
    }));
  }

  // --- Evaluation report ------------------------------------------------

  async saveReport(workspaceId: string, report: EvaluationReport): Promise<EvaluationReport> {
    const idReport = `rep_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    // One report per workspace: finishing a later round replaces the previous
    // debrief, which is what the store this replaced did. Delete + create in one
    // transaction so a reader never sees a report with no notebook rows.
    await prisma.$transaction([
      prisma.report.deleteMany({ where: { id_workspace: workspaceId } }),
      prisma.report.create({
        data: {
          id_report: idReport,
          id_workspace: workspaceId,
          letter: report.letter,
          reflection: report.notebook.reflection,
          continue_learning: report.continueLearning,
          learned: {
            create: report.notebook.learned.map((content, seq) => ({
              id_learned: `lrn_${idReport}_${seq}`,
              seq,
              content,
            })),
          },
          confused: {
            create: report.notebook.stillConfused.map((content, seq) => ({
              id_confused: `cnf_${idReport}_${seq}`,
              seq,
              content,
            })),
          },
        },
      }),
    ]);
    return report;
  }

  async getReport(workspaceId: string): Promise<EvaluationReport | undefined> {
    const row = await prisma.report.findUnique({
      where: { id_workspace: workspaceId },
      include: {
        learned: { orderBy: { seq: "asc" } },
        confused: { orderBy: { seq: "asc" } },
      },
    });
    if (!row) return undefined;
    return {
      letter: row.letter,
      notebook: {
        learned: row.learned.map((item) => item.content),
        stillConfused: row.confused.map((item) => item.content),
        reflection: row.reflection,
      },
      continueLearning: row.continue_learning,
    };
  }

  // --- PDF blob ---------------------------------------------------------

  async savePdf(workspaceId: string, blob: StoredBlob): Promise<void> {
    await prisma.workspace.updateMany({
      where: { id_workspace: workspaceId },
      // Prisma's Bytes maps to Uint8Array; a Node Buffer is one, but with a
      // wider ArrayBufferLike, so it is narrowed here rather than cast.
      data: { pdf_data: new Uint8Array(blob.data), pdf_mime: blob.mime },
    });
  }

  async getPdf(workspaceId: string): Promise<StoredBlob | undefined> {
    const row = await prisma.workspace.findUnique({
      where: { id_workspace: workspaceId },
      select: { pdf_data: true, pdf_mime: true },
    });
    if (!row?.pdf_data) return undefined;
    return { data: Buffer.from(row.pdf_data), mime: row.pdf_mime ?? "application/pdf" };
  }

  // --- Reference material -----------------------------------------------

  async saveReference(workspaceId: string, text: string): Promise<void> {
    await prisma.workspace.updateMany({
      where: { id_workspace: workspaceId },
      data: { reference_text: text },
    });
  }

  async getReference(workspaceId: string): Promise<string | undefined> {
    const row = await prisma.workspace.findUnique({
      where: { id_workspace: workspaceId },
      select: { reference_text: true },
    });
    return row?.reference_text ?? undefined;
  }

  // --- Reference index --------------------------------------------------

  async saveReferenceIndex(workspaceId: string, index: ReferenceIndex): Promise<void> {
    await prisma.workspace.updateMany({
      where: { id_workspace: workspaceId },
      data: { reference_index: index.toJSON() as unknown as Prisma.InputJsonValue },
    });
  }

  async getReferenceIndex(workspaceId: string): Promise<ReferenceIndex | undefined> {
    const row = await prisma.workspace.findUnique({
      where: { id_workspace: workspaceId },
      select: { reference_index: true },
    });
    if (!row?.reference_index) return undefined;
    return ReferenceIndex.fromJSON(
      row.reference_index as unknown as SerializedReferenceIndex,
    );
  }
}

// --- Helpers ---------------------------------------------------------------

/**
 * Make sure the calling device has a `users` row to own its workspaces. Until
 * real accounts exist the device id *is* the identity, so the derived username
 * and email are placeholders that are unique by construction.
 */
async function ensureOwner(ownerId: string): Promise<void> {
  await prisma.users.upsert({
    where: { id_user: ownerId },
    create: {
      id_user: ownerId,
      username: ownerId,
      email: `${ownerId}@device.cogniva.local`,
      password_hash: null,
      profile_photo: null,
    },
    update: {},
  });
}

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id_workspace,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    // Rebuilt rather than stored: it is a route on this server, not data.
    pdfUrl: row.pdf_mime ? `/api/workspaces/${row.id_workspace}/pdf` : undefined,
    state: row.state as WorkspaceState,
    currentWhiteboardSnapshot: row.whiteboard_snapshot ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Coerce an opaque client document (a tldraw snapshot, a Timeline) into what a
 * Json column accepts. `undefined` clears the column rather than leaving it
 * untouched, matching the in-memory store's assignment semantics.
 */
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}
