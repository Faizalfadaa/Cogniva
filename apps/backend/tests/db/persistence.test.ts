/**
 * Integration tests for the Postgres storage path (Architecture Document §8).
 *
 * The rest of the suite runs against the in-memory doubles, which can only prove
 * that the callers use the storage contract correctly — never that the contract
 * survives a round trip through Postgres. These tests use the real Prisma stores
 * and therefore need a database: `npm run test:db` (see vitest.db.config.ts).
 *
 * Everything created here is namespaced by a per-run suffix and dropped in
 * afterAll, so the suite is safe to point at a shared development database.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";
import { utcNowIso } from "../../src/contracts/common.js";
import type { EvaluationResult } from "../../src/contracts/evaluation.js";
import type { LearnerResponse, LearnerState } from "../../src/contracts/learner.js";
import type { Session } from "../../src/contracts/session.js";
import type { TeachingTurn } from "../../src/contracts/teaching.js";
import type { Workspace } from "../../src/contracts/workspace.js";
import { disconnectDatabase, prisma } from "../../src/database/index.js";
import { PrismaSessionStore } from "../../src/database/stores/prismaSessionStore.js";
import { PrismaWorkspaceStore } from "../../src/database/stores/prismaWorkspaceStore.js";
import { buildReferenceIndex } from "../../src/modules/retrieval/index.js";
import { newId, sessions } from "../../src/modules/storage/sessionStore.js";
import { workspaces } from "../../src/modules/workspace/workspaceStore.js";

const RUN = randomUUID().slice(0, 8);
const owner = `test-owner-${RUN}`;
const otherOwner = `test-other-${RUN}`;

/** Everything the fixtures create, torn down in afterAll. */
const created = { owners: [owner, otherOwner], sessions: [] as string[] };

async function makeSession(overrides: Partial<Session> = {}): Promise<Session> {
  const session: Session = {
    sessionId: newId("ses"),
    topicId: "topic_photosynthesis",
    status: "SETUP",
    createdAt: utcNowIso(),
    turnCount: 0,
    tokensUsed: 0,
    evaluationIds: [],
    ...overrides,
  };
  created.sessions.push(session.sessionId);
  return sessions.saveSession(session);
}

async function makeWorkspace(ownerId = owner): Promise<Workspace> {
  const session = await makeSession();
  const now = utcNowIso();
  const workspace: Workspace = {
    id: `ws_${randomUUID().replace(/-/g, "").slice(0, 8)}`,
    state: "Draft",
    createdAt: now,
    updatedAt: now,
  };
  return workspaces.create(workspace, ownerId, session.sessionId);
}

beforeAll(() => {
  // Guard against a misconfigured run silently testing the Map-based double and
  // reporting green without ever touching Postgres.
  expect(process.env.COGNIVA_STORE).not.toBe("memory");
  expect(process.env.DATABASE_URL, "DATABASE_URL must be set for the DB suite").toBeTruthy();
});

afterAll(async () => {
  // A session outlives its workspace (the foreign key runs workspace -> session,
  // so a workspace can be deleted without taking the session with it), and the
  // HTTP route creates sessions this file never names. So: owners first, which
  // cascades their workspaces, then every session this run touched, then any
  // session left pointing at a workspace that is now gone.
  await prisma.users.deleteMany({ where: { id_user: { in: created.owners } } });
  await prisma.session.deleteMany({ where: { id_session: { in: created.sessions } } });
  await prisma.session.deleteMany({ where: { workspace: { is: null }, topic_id: { startsWith: "ws_" } } });
  await disconnectDatabase();
});

describe("workspace persistence", () => {
  it("round-trips a workspace and its metadata", async () => {
    const ws = await makeWorkspace();

    const loaded = await workspaces.get(ws.id);
    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(ws.id);
    expect(loaded?.state).toBe("Draft");
    // Timestamps survive the DateTime column as the same ISO instant.
    expect(new Date(loaded!.createdAt).getTime()).toBe(new Date(ws.createdAt).getTime());

    const snapshot = { store: "tldraw", shapes: [{ id: "shape:a", x: 1.5 }] };
    await workspaces.save({
      ...loaded!,
      title: "Fotosintesis",
      description: "Bab 3",
      state: "Teaching",
      currentWhiteboardSnapshot: snapshot,
      thumbnailUrl: "data:image/png;base64,iVBORw0KGgo=",
      updatedAt: utcNowIso(),
    });

    const updated = await workspaces.get(ws.id);
    expect(updated?.title).toBe("Fotosintesis");
    expect(updated?.description).toBe("Bab 3");
    expect(updated?.state).toBe("Teaching");
    // The opaque client document comes back structurally identical.
    expect(updated?.currentWhiteboardSnapshot).toEqual(snapshot);
    expect(updated?.thumbnailUrl).toContain("base64");
  });

  it("isolates workspaces by owner", async () => {
    const mine = await makeWorkspace(owner);
    const theirs = await makeWorkspace(otherOwner);

    expect(await workspaces.isOwner(mine.id, owner)).toBe(true);
    expect(await workspaces.isOwner(mine.id, otherOwner)).toBe(false);
    expect(await workspaces.isOwner("ws_doesnotexist", owner)).toBe(false);

    const listed = (await workspaces.list(owner)).map((w) => w.id);
    expect(listed).toContain(mine.id);
    expect(listed).not.toContain(theirs.id);
  });

  it("lists a device's workspaces most-recently-updated first", async () => {
    const scoped = `test-order-${RUN}`;
    created.owners.push(scoped);

    const first = await makeWorkspace(scoped);
    const second = await makeWorkspace(scoped);
    // Touch the older one so it must sort ahead of the newer one.
    await workspaces.save({ ...first, updatedAt: new Date(Date.now() + 60_000).toISOString() });

    const listed = (await workspaces.list(scoped)).map((w) => w.id);
    expect(listed.slice(0, 2)).toEqual([first.id, second.id]);
  });

  it("stores checkpoints in submission order and patches them in place", async () => {
    const ws = await makeWorkspace();

    for (const n of [0, 1, 2]) {
      await workspaces.addCheckpoint(ws.id, {
        id: `chk_${RUN}_${n}`,
        snapshotImageUrl: `data:image/png;base64,img${n}`,
        whiteboardSnapshot: { n },
        audioUrl: n === 1 ? "data:audio/webm;base64,aaa" : undefined,
        timeline: n === 2 ? { recordingStartedAt: utcNowIso(), events: [] } : undefined,
        createdAt: utcNowIso(),
      });
    }

    await workspaces.updateCheckpoint(ws.id, `chk_${RUN}_1`, {
      learnerResponse: "Kenapa begitu?",
    });
    // A checkpoint from another workspace must not be reachable through this one.
    const other = await makeWorkspace();
    await workspaces.updateCheckpoint(other.id, `chk_${RUN}_0`, {
      learnerResponse: "should not land",
    });

    const list = await workspaces.listCheckpoints(ws.id);
    expect(list.map((c) => c.id)).toEqual([`chk_${RUN}_0`, `chk_${RUN}_1`, `chk_${RUN}_2`]);
    expect(list[0].learnerResponse).toBeUndefined();
    expect(list[1].learnerResponse).toBe("Kenapa begitu?");
    expect(list[1].audioUrl).toBe("data:audio/webm;base64,aaa");
    expect(list[1].whiteboardSnapshot).toEqual({ n: 1 });
    expect(list[2].timeline?.events).toEqual([]);
    expect(list[0].timeline).toBeUndefined();
  });

  it("keeps chat messages in send order", async () => {
    const ws = await makeWorkspace();
    const senders = ["user", "learner", "user"] as const;

    for (const [n, sender] of senders.entries()) {
      await workspaces.addMessage(ws.id, {
        id: `msg_${RUN}_${n}`,
        sender,
        content: `pesan ${n}`,
        // Identical timestamps: ordering must not depend on clock resolution.
        createdAt: "2026-09-05T00:00:00.000Z",
      });
    }

    const list = await workspaces.listMessages(ws.id);
    expect(list.map((m) => m.content)).toEqual(["pesan 0", "pesan 1", "pesan 2"]);
    expect(list.map((m) => m.sender)).toEqual(["user", "learner", "user"]);
  });

  it("replaces the report when a later round finishes", async () => {
    const ws = await makeWorkspace();
    expect(await workspaces.getReport(ws.id)).toBeUndefined();

    await workspaces.saveReport(ws.id, {
      letter: "Terima kasih!",
      notebook: { learned: ["a", "b"], stillConfused: ["c"], reflection: "lumayan" },
      continueLearning: ["Respirasi"],
    });

    const second = {
      letter: "Babak dua",
      notebook: { learned: ["x"], stillConfused: ["y", "z"], reflection: "lebih baik" },
      continueLearning: ["Siklus Calvin", "Klorofil"],
    };
    await workspaces.saveReport(ws.id, second);

    expect(await workspaces.getReport(ws.id)).toEqual(second);
    // Exactly one report row survives, so the notebook can't accumulate.
    expect(await prisma.report.count({ where: { id_workspace: ws.id } })).toBe(1);
  });

  it("stores the PDF, its text, and the retrieval index", async () => {
    const ws = await makeWorkspace();
    const pdf = Buffer.from("%PDF-1.4 fake bytes", "utf8");

    await workspaces.savePdf(ws.id, { data: pdf, mime: "application/pdf" });
    const blob = await workspaces.getPdf(ws.id);
    expect(blob?.mime).toBe("application/pdf");
    expect(blob?.data.equals(pdf)).toBe(true);
    // A stored PDF is what makes the workspace advertise its download route.
    expect((await workspaces.get(ws.id))?.pdfUrl).toBe(`/api/workspaces/${ws.id}/pdf`);

    const text = "Fotosintesis mengubah cahaya menjadi energi kimia.\n\nATP dan NADPH terbentuk.";
    await workspaces.saveReference(ws.id, text);
    expect(await workspaces.getReference(ws.id)).toBe(text);

    // keywordOnly keeps the test offline; the vector path is the same column.
    const index = await buildReferenceIndex(text, { keywordOnly: true });
    await workspaces.saveReferenceIndex(ws.id, index);

    const reloaded = await workspaces.getReferenceIndex(ws.id);
    expect(reloaded?.size).toBe(index.size);
    expect(reloaded?.mode).toBe("keyword");
    // A rebuilt index must still search, not just deserialize.
    const hits = reloaded!.search("ATP", null, { k: 1, keywordWeight: 1 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("cascades a delete to everything the workspace owns", async () => {
    const ws = await makeWorkspace();
    const sessionId = (await workspaces.sessionId(ws.id))!;

    await workspaces.addCheckpoint(ws.id, {
      id: `chk_del_${RUN}`,
      snapshotImageUrl: "data:image/png;base64,x",
      whiteboardSnapshot: {},
      createdAt: utcNowIso(),
    });
    await workspaces.addMessage(ws.id, {
      id: `msg_del_${RUN}`,
      sender: "user",
      content: "halo",
      createdAt: utcNowIso(),
    });
    await workspaces.saveReport(ws.id, {
      letter: "l",
      notebook: { learned: ["a"], stillConfused: [], reflection: "r" },
      continueLearning: [],
    });

    await workspaces.delete(ws.id);
    await sessions.deleteSession(sessionId);

    expect(await workspaces.get(ws.id)).toBeUndefined();
    expect(await sessions.getSession(sessionId)).toBeUndefined();
    expect(await prisma.checkpoint.count({ where: { id_workspace: ws.id } })).toBe(0);
    expect(await prisma.chat_message.count({ where: { id_workspace: ws.id } })).toBe(0);
    expect(await prisma.report.count({ where: { id_workspace: ws.id } })).toBe(0);
  });
});

describe("session persistence", () => {
  it("round-trips a session through every lifecycle field", async () => {
    const started = utcNowIso();
    const session = await makeSession({ status: "TEACHING", startedAt: started, turnCount: 3 });

    const loaded = await sessions.getSession(session.sessionId);
    expect(loaded?.status).toBe("TEACHING");
    expect(loaded?.turnCount).toBe(3);
    expect(new Date(loaded!.startedAt!).getTime()).toBe(new Date(started).getTime());
    expect(loaded?.endedAt).toBeUndefined();
    expect(loaded?.evaluationIds).toEqual([]);

    await sessions.saveSession({ ...loaded!, status: "ENDED", endedAt: utcNowIso() });
    expect((await sessions.getSession(session.sessionId))?.status).toBe("ENDED");
  });

  it("accumulates token usage without losing concurrent turns", async () => {
    const session = await makeSession();

    // Increments rather than read-modify-write, so overlapping turns both count.
    await Promise.all([
      sessions.addTokenUsage(session.sessionId, 100),
      sessions.addTokenUsage(session.sessionId, 40),
      sessions.addTokenUsage(session.sessionId, 7),
    ]);

    expect((await sessions.getSession(session.sessionId))?.tokensUsed).toBe(147);
    // A missing session is a no-op, never a thrown error (§7.3).
    await expect(sessions.addTokenUsage("ses_gone", 10)).resolves.toBeUndefined();
  });

  it("keeps evaluations as ordered history and reports the latest", async () => {
    const session = await makeSession({ status: "ENDED" });
    const evaluation = (n: number): EvaluationResult => ({
      evaluationId: `ev_${RUN}_${n}`,
      sessionId: session.sessionId,
      score: n * 10,
      findings: [{ category: "CORRECT", concept: `c${n}`, detail: `d${n}`, evidenceTurnIndex: n }],
      summary: `ringkasan ${n}`,
      strengths: [`s${n}`],
      improvements: [`i${n}`],
      generatedAt: utcNowIso(),
    });

    await sessions.saveEvaluation(evaluation(1));
    await sessions.saveEvaluation(evaluation(2));

    const history = await sessions.listEvaluations(session.sessionId);
    expect(history.map((e) => e.evaluationId)).toEqual([`ev_${RUN}_1`, `ev_${RUN}_2`]);
    // Nested findings survive the Json column intact.
    expect(history[0].findings[0]).toEqual({
      category: "CORRECT",
      concept: "c1",
      detail: "d1",
      evidenceTurnIndex: 1,
    });
    expect((await sessions.getLatestEvaluation(session.sessionId))?.score).toBe(20);
    expect((await sessions.getEvaluationById(`ev_${RUN}_1`))?.score).toBe(10);
    // The session's own view of its history matches.
    expect((await sessions.getSession(session.sessionId))?.evaluationIds).toEqual([
      `ev_${RUN}_1`,
      `ev_${RUN}_2`,
    ]);
  });

  it("stores the learner state and overwrites it each turn", async () => {
    const session = await makeSession();
    const state = (turn: number): LearnerState => ({
      sessionId: session.sessionId,
      understoodConcepts: ["cahaya"],
      activeMisconceptions: [{ concept: "ATP", belief: "ATP itu enzim" }],
      openGaps: ["siklus Calvin"],
      questionsAsked: [`q${turn}`],
      updatedAtTurn: turn,
    });

    await sessions.saveLearnerState(state(0));
    await sessions.saveLearnerState(state(1));

    const loaded = await sessions.getLearnerState(session.sessionId);
    expect(loaded?.updatedAtTurn).toBe(1);
    expect(loaded?.activeMisconceptions).toEqual([{ concept: "ATP", belief: "ATP itu enzim" }]);
    expect(await prisma.learner_state.count({ where: { id_session: session.sessionId } })).toBe(1);
  });

  it("reads back the transcript with each turn's learner response joined on", async () => {
    const session = await makeSession({ status: "TEACHING" });

    for (const turnIndex of [0, 1]) {
      const snapshotId = newId("snap");
      await sessions.saveSnapshot({
        snapshotId,
        sessionId: session.sessionId,
        turnIndex,
        image: `image-bytes-${turnIndex}`,
        format: "png",
        capturedAt: utcNowIso(),
      });

      const response: LearnerResponse = {
        responseId: newId("resp"),
        turnIndex,
        type: "question",
        text: `pertanyaan ${turnIndex}`,
        targetConcept: null,
        derivedFrom: "new_info",
      };
      await sessions.saveResponse(session.sessionId, response);

      const turn: TeachingTurn = {
        turnIndex,
        sessionId: session.sessionId,
        snapshotId,
        interpretation: {
          snapshotId,
          transcribedText: `papan ${turnIndex}`,
          elements: [{ type: "text", content: `t${turnIndex}`, confidence: 0.9 }],
          confidence: 0.9,
          needsConfirmation: false,
        },
        typedInput: null,
        learnerResponseId: response.responseId,
        createdAt: utcNowIso(),
      };
      await sessions.saveTurn(turn);
    }

    const turns = await sessions.listTurns(session.sessionId);
    expect(turns.map((t) => t.turnIndex)).toEqual([0, 1]);
    expect(turns[1].interpretation.elements[0].content).toBe("t1");

    expect((await sessions.lastTurn(session.sessionId))?.turnIndex).toBe(1);

    const rows = await sessions.listTurnsWithResponses(session.sessionId);
    expect(rows).toHaveLength(2);
    expect(rows.map(({ response }) => response?.text)).toEqual([
      "pertanyaan 0",
      "pertanyaan 1",
    ]);

    // The previous board image is what the next turn compares against.
    const snapshot = await sessions.getSnapshot(turns[0].snapshotId);
    expect(snapshot?.image).toBe("image-bytes-0");
  });
});

describe("a workspace survives a restart", () => {
  it("is readable by a store built from scratch", async () => {
    const ws = await makeWorkspace();
    await workspaces.save({ ...ws, title: "Bertahan", state: "Teaching" });
    await workspaces.addMessage(ws.id, {
      id: `msg_restart_${RUN}`,
      sender: "user",
      content: "masih ada?",
      createdAt: utcNowIso(),
    });

    // Fresh instances hold no state of their own, so anything they can read came
    // from the database rather than from a Map left over in this process.
    const freshWorkspaces = new PrismaWorkspaceStore();
    const freshSessions = new PrismaSessionStore();

    const reloaded = await freshWorkspaces.get(ws.id);
    expect(reloaded?.title).toBe("Bertahan");
    expect(reloaded?.state).toBe("Teaching");
    expect((await freshWorkspaces.listMessages(ws.id))[0].content).toBe("masih ada?");

    const sessionId = (await freshWorkspaces.sessionId(ws.id))!;
    expect((await freshSessions.getSession(sessionId))?.sessionId).toBe(sessionId);
  });
});

describe("the HTTP API over Postgres", () => {
  it("creates, edits, and re-reads a workspace through the real routes", async () => {
    const app = await buildApp();
    const client = `test-http-${RUN}`;
    created.owners.push(client);
    const headers = { "x-client-id": client };

    try {
      const createdRes = await app.inject({
        method: "POST",
        url: "/api/workspaces",
        headers,
      });
      expect(createdRes.statusCode).toBe(201);
      const id = createdRes.json().id as string;

      await app.inject({
        method: "PATCH",
        url: `/api/workspaces/${id}`,
        headers,
        payload: { title: "Lewat HTTP", description: "deskripsi" },
      });
      await app.inject({
        method: "PUT",
        url: `/api/workspaces/${id}/draft`,
        headers,
        payload: { snapshot: { shapes: ["a"] }, thumbnail: "data:image/png;base64,zz" },
      });

      const read = await app.inject({ method: "GET", url: `/api/workspaces/${id}`, headers });
      expect(read.statusCode).toBe(200);
      expect(read.json().title).toBe("Lewat HTTP");
      // Saving the first draft moves a blank workspace into teaching.
      expect(read.json().state).toBe("Teaching");
      expect(read.json().currentWhiteboardSnapshot).toEqual({ shapes: ["a"] });

      const list = await app.inject({ method: "GET", url: "/api/workspaces", headers });
      expect(list.json().map((w: Workspace) => w.id)).toContain(id);

      // Another device sees a 404, not someone else's workspace.
      const intruder = await app.inject({
        method: "GET",
        url: `/api/workspaces/${id}`,
        headers: { "x-client-id": `test-intruder-${RUN}` },
      });
      expect(intruder.statusCode).toBe(404);

      const chat = await app.inject({
        method: "POST",
        url: `/api/workspaces/${id}/messages`,
        headers,
        payload: { content: "halo" },
      });
      expect(chat.statusCode).toBe(201);
      const messages = await app.inject({
        method: "GET",
        url: `/api/workspaces/${id}/messages`,
        headers,
      });
      expect(messages.json()[0].content).toBe("halo");

      const removed = await app.inject({
        method: "DELETE",
        url: `/api/workspaces/${id}`,
        headers,
      });
      expect(removed.statusCode).toBe(204);
      expect(await workspaces.get(id)).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
