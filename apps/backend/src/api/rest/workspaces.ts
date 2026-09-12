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
  saveReferenceTextSchema,
  sendMessageSchema,
  submitCheckpointSchema,
  suggestReferencesSchema,
  updateMetaSchema,
  uploadPdfSchema,
  useReferenceSchema,
} from "../../contracts/workspace.js";
import { getCurrentUser } from "../../modules/auth/authService.js";
import { storageContext } from "../../modules/storage/context.js";
import { endGuest, guestForWorkspace, guestStorage, rememberGuestWorkspace } from "../../modules/storage/guestStorage.js";
import * as service from "../../modules/workspace/workspaceService.js";
import { workspaces } from "../../modules/workspace/workspaceStore.js";

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  const owners = new WeakMap<FastifyRequest, string>();
  app.addHook("onRequest", (req, reply, done) => {
    const header = req.headers["x-guest-session"];
    const guestId = typeof header === "string" ? header : undefined;
    const path = req.url.split("?")[0];
    const id = (req.params as { id?: string })?.id;
    const binary = req.method === "GET" && (path.endsWith("/pdf") || path.includes("/audio/"));
    const binaryGuest = binary && id ? guestForWorkspace(id) : undefined;
    if (binaryGuest) {
      reply.header("Cache-Control", "no-store");
      owners.set(req, binaryGuest.ownerId);
      storageContext.run(binaryGuest, done);
      return;
    }
    if (guestId) {
      if (!/^[a-zA-Z0-9_-]{16,128}$/.test(guestId)) {
        reply.code(400).send({ detail: "Invalid guest session" });
        return;
      }
      // Explicit guest mode must never inherit an existing login cookie.
      owners.set(req, guestId);
      reply.header("Cache-Control", "no-store");
      storageContext.run(guestStorage(guestId), done);
      return;
    }
    getCurrentUser(req).then((user) => {
      if (user) {
        owners.set(req, user.id);
        done();
      } else if (binary) {
        done();
      } else {
        reply.code(401).send({ detail: "Sign in or start a guest session" });
      }
    }, done);
  });

  async function ownerOf(req: FastifyRequest): Promise<string> {
    return owners.get(req) ?? service.ANON_OWNER;
  }

  app.post("/guest-session/end", async (_req, reply) => {
    const guest = storageContext.getStore();
    if (guest) endGuest(guest.ownerId);
    return reply.code(204).send();
  });
  // Every /workspaces/:id route must belong to the current account or guest
  // session. The collection routes (no :id) are exempt, as are the
  // two binary GETs the browser fetches through an element — <iframe> for the
  // PDF and <audio> for learner speech — which cannot carry a custom header.
  // Both are addressed by unguessable random ids, matching the posture the PDF
  // route already had.
  app.addHook("preHandler", async (req, reply) => {
    const id = (req.params as { id?: string })?.id;
    if (!id) return; // /workspaces collection
    const path = req.url.split("?")[0];
    if (req.method === "GET" && (path.endsWith("/pdf") || path.includes("/audio/"))) return;
    if (!(await service.isOwner(id, await ownerOf(req)))) return notFound(reply);
  });

  // --- Home ---------------------------------------------------------------

  app.get("/workspaces", async (req) => service.listWorkspaces(await ownerOf(req)));

  app.post("/workspaces", async (req, reply) => {
    reply.code(201);
    const workspace = await service.createWorkspace(await ownerOf(req));
    const guest = storageContext.getStore();
    if (guest) rememberGuestWorkspace(workspace.id, guest.ownerId);
    return workspace;
  });

  // --- Workspace meta -----------------------------------------------------

  app.get("/workspaces/:id", async (req, reply) => {
    const ws = await service.getWorkspace(idOf(req.params));
    return ws ?? notFound(reply);
  });

  app.patch("/workspaces/:id", async (req, reply) => {
    const parsed = updateMetaSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Invalid meta payload");
    const ws = await service.updateMeta(idOf(req.params), parsed.data);
    return ws ?? notFound(reply);
  });

  app.delete("/workspaces/:id", async (req, reply) => {
    const ok = await service.deleteWorkspace(idOf(req.params));
    if (!ok) return notFound(reply);
    return reply.code(204).send();
  });

  app.put("/workspaces/:id/draft", async (req, reply) => {
    const parsed = saveDraftSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Invalid draft payload");
    const ws = await service.saveDraft(idOf(req.params), parsed.data);
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

  // Reference material the user wrote or pasted. Unlike the two routes below it
  // spends no tokens, so it answers as fast as any other write.
  app.post("/workspaces/:id/reference-text", async (req, reply) => {
    const parsed = saveReferenceTextSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Invalid reference text payload");
    const result = await service.setReferenceText(idOf(req.params), parsed.data.text);
    return result ?? notFound(reply);
  });

  // --- Reference sourcing (§3.7) ------------------------------------------
  //
  // Both of these answer synchronously, unlike the teaching-turn routes: the
  // user is waiting in a dialog, and a polled empty list would be worse than a
  // spinner. Neither is a GET, because both spend model tokens — a GET that
  // costs money is a route a browser or a crawler will happily re-run.

  app.post("/workspaces/:id/references/suggest", async (req, reply) => {
    const parsed = suggestReferencesSchema.safeParse(req.body ?? {});
    if (!parsed.success) return badRequest(reply, "Invalid suggestion payload");
    const suggestions = await service.suggestReferences(idOf(req.params), parsed.data.hint);
    return suggestions ?? notFound(reply);
  });

  app.post("/workspaces/:id/references/use", async (req, reply) => {
    const parsed = useReferenceSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Invalid reference payload");
    const result = await service.useReference(idOf(req.params), parsed.data);
    if (!result) return notFound(reply);
    // A source that could not be read is a normal outcome, not a server fault:
    // 422 lets the UI show `problem` and let the user pick another option.
    if (!result.ok) reply.code(422);
    return result;
  });

  app.get("/workspaces/:id/pdf", async (req, reply) => {
    const blob = await workspaces.getPdf(idOf(req.params));
    if (!blob) return notFound(reply);
    return reply.type(blob.mime).send(blob.data);
  });

  // Synthesized learner speech (§TTS). Served by URL rather than inlined into
  // the polled checkpoint/message lists, which would otherwise carry hundreds
  // of kilobytes of audio on every poll.
  app.get("/workspaces/:id/audio/:audioId", async (req, reply) => {
    const { id, audioId } = req.params as { id: string; audioId: string };
    const blob = await workspaces.getAudioClip(id, audioId);
    if (!blob) return notFound(reply);
    // Immutable: a clip's id is unique to its rendered content, so the browser
    // can keep it for the life of the session and replay it without refetching.
    return reply
      .type(blob.mime)
      .header("Cache-Control", storageContext.getStore() ? "no-store" : "private, max-age=86400, immutable")
      .send(blob.data);
  });

  // --- Teaching checkpoints ----------------------------------------------

  app.post("/workspaces/:id/checkpoints", async (req, reply) => {
    const parsed = submitCheckpointSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Invalid checkpoint payload");
    const checkpoint = await service.submitCheckpoint(idOf(req.params), parsed.data);
    if (!checkpoint) return notFound(reply);
    reply.code(201);
    return checkpoint;
  });

  app.get("/workspaces/:id/checkpoints", async (req, reply) => {
    const list = await service.getCheckpoints(idOf(req.params));
    return list ?? notFound(reply);
  });

  // --- Chat ---------------------------------------------------------------

  app.post("/workspaces/:id/messages", async (req, reply) => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, "Message content is required");
    const message = await service.sendChatMessage(idOf(req.params), parsed.data.content);
    if (!message) return notFound(reply);
    reply.code(201);
    return message;
  });

  app.get("/workspaces/:id/messages", async (req, reply) => {
    const list = await service.getChatMessages(idOf(req.params));
    return list ?? notFound(reply);
  });

  // --- Evaluation ---------------------------------------------------------

  app.post("/workspaces/:id/finish", async (req, reply) => {
    const ok = await service.finishSession(idOf(req.params));
    if (!ok) return notFound(reply);
    return reply.code(204).send();
  });

  app.get("/workspaces/:id/report", async (req, reply) => {
    if (!(await service.getWorkspace(idOf(req.params)))) return notFound(reply);
    const report = await service.getReport(idOf(req.params));
    if (!report) return reply.code(404).send({ detail: "Report not ready yet" });
    return report;
  });

  // Resume a finished workspace back into teaching (§4.2, §5.4).
  app.post("/workspaces/:id/resume", async (req, reply) => {
    const ws = await service.resumeSession(idOf(req.params));
    return ws ?? notFound(reply);
  });
}

// --- Helpers ---------------------------------------------------------------

function idOf(params: unknown): string {
  return (params as { id: string }).id;
}

function notFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).send({ detail: "Workspace not found" });
}

function badRequest(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(400).send({ detail });
}
