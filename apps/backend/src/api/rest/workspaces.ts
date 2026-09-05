/**
 * REST endpoints for the workspace-centric UI (the CognivaBridge contract).
 *
 * Registered under /api. These back the frontend bridge directly: the UI polls
 * getWorkspace / getCheckpoints / getChatMessages and the heavy calls (submit
 * checkpoint, send message, finish) return immediately while the agent work
 * runs in the background (see workspaceService). Session lifecycle endpoints in
 * ./index.ts are unchanged — this is an additive layer over the same store.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  saveDraftSchema,
  sendMessageSchema,
  submitCheckpointSchema,
  updateMetaSchema,
  uploadPdfSchema,
} from "../../contracts/workspace.js";
import * as service from "../../modules/workspace/workspaceService.js";
import { workspaces } from "../../modules/workspace/workspaceStore.js";

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  // Per-device isolation: every /workspaces/:id route must belong to the calling
  // device (x-client-id). The collection routes (no :id) are exempt, as are the
  // two binary GETs the browser fetches through an element — <iframe> for the
  // PDF and <audio> for learner speech — which cannot carry a custom header.
  // Both are addressed by unguessable random ids, matching the posture the PDF
  // route already had.
  app.addHook("preHandler", async (req, reply) => {
    const id = (req.params as { id?: string })?.id;
    if (!id) return; // /workspaces collection
    const path = req.url.split("?")[0];
    if (req.method === "GET" && (path.endsWith("/pdf") || path.includes("/audio/"))) return;
    if (!service.isOwner(id, clientOf(req))) return notFound(reply);
  });

  // --- Home ---------------------------------------------------------------

  app.get("/workspaces", async (req) => service.listWorkspaces(clientOf(req)));

  app.post("/workspaces", async (req, reply) => {
    reply.code(201);
    return service.createWorkspace(clientOf(req));
  });

  // --- Workspace meta -----------------------------------------------------

  app.get("/workspaces/:id", async (req, reply) => {
    const ws = service.getWorkspace(idOf(req.params));
    return ws ?? notFound(reply);
  });

  app.patch("/workspaces/:id", async (req, reply) => {
    const parsed = updateMetaSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Invalid meta payload");
    const ws = service.updateMeta(idOf(req.params), parsed.data);
    return ws ?? notFound(reply);
  });

  app.delete("/workspaces/:id", async (req, reply) => {
    const ok = service.deleteWorkspace(idOf(req.params));
    if (!ok) return notFound(reply);
    return reply.code(204).send();
  });

  app.put("/workspaces/:id/draft", async (req, reply) => {
    const parsed = saveDraftSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Invalid draft payload");
    const ws = service.saveDraft(idOf(req.params), parsed.data);
    return ws ?? notFound(reply);
  });

  app.post("/workspaces/:id/pdf", async (req, reply) => {
    const parsed = uploadPdfSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Invalid pdf payload");
    const ws = await service.setPdf(
      idOf(req.params),
      Buffer.from(parsed.data.data, "base64"),
      parsed.data.mime,
    );
    return ws ?? notFound(reply);
  });

  app.get("/workspaces/:id/pdf", async (req, reply) => {
    const blob = workspaces.getPdf(idOf(req.params));
    if (!blob) return notFound(reply);
    return reply.type(blob.mime).send(blob.data);
  });

  // Synthesized learner speech (§TTS). Served by URL rather than inlined into
  // the polled checkpoint/message lists, which would otherwise carry hundreds
  // of kilobytes of audio on every poll.
  app.get("/workspaces/:id/audio/:audioId", async (req, reply) => {
    const { id, audioId } = req.params as { id: string; audioId: string };
    const blob = workspaces.getAudioClip(id, audioId);
    if (!blob) return notFound(reply);
    // Immutable: a clip's id is unique to its rendered content, so the browser
    // can keep it for the life of the session and replay it without refetching.
    return reply
      .type(blob.mime)
      .header("Cache-Control", "private, max-age=86400, immutable")
      .send(blob.data);
  });

  // --- Teaching checkpoints ----------------------------------------------

  app.post("/workspaces/:id/checkpoints", async (req, reply) => {
    const parsed = submitCheckpointSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Invalid checkpoint payload");
    const checkpoint = service.submitCheckpoint(idOf(req.params), parsed.data);
    if (!checkpoint) return notFound(reply);
    reply.code(201);
    return checkpoint;
  });

  app.get("/workspaces/:id/checkpoints", async (req, reply) => {
    const list = service.getCheckpoints(idOf(req.params));
    return list ?? notFound(reply);
  });

  // --- Chat ---------------------------------------------------------------

  app.post("/workspaces/:id/messages", async (req, reply) => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Message content is required");
    const message = service.sendChatMessage(idOf(req.params), parsed.data.content);
    if (!message) return notFound(reply);
    reply.code(201);
    return message;
  });

  app.get("/workspaces/:id/messages", async (req, reply) => {
    const list = service.getChatMessages(idOf(req.params));
    return list ?? notFound(reply);
  });

  // --- Evaluation ---------------------------------------------------------

  app.post("/workspaces/:id/finish", async (req, reply) => {
    const ok = service.finishSession(idOf(req.params));
    if (!ok) return notFound(reply);
    return reply.code(204).send();
  });

  app.get("/workspaces/:id/report", async (req, reply) => {
    if (!service.getWorkspace(idOf(req.params))) return notFound(reply);
    const report = service.getReport(idOf(req.params));
    if (!report) return reply.code(404).send({ detail: "Report not ready yet" });
    return report;
  });

  // Resume a finished workspace back into teaching (§4.2, §5.4).
  app.post("/workspaces/:id/resume", async (req, reply) => {
    const ws = service.resumeSession(idOf(req.params));
    return ws ?? notFound(reply);
  });
}

// --- Helpers ---------------------------------------------------------------

function idOf(params: unknown): string {
  return (params as { id: string }).id;
}

/** The calling device's id (x-client-id header); "anonymous" when absent. */
function clientOf(req: FastifyRequest): string {
  const h = req.headers["x-client-id"];
  const value = Array.isArray(h) ? h[0] : h;
  return value?.trim() || service.ANON_OWNER;
}

function notFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).send({ detail: "Workspace not found" });
}

function badRequest(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(400).send({ detail });
}
