import Fastify from "fastify";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.COGNIVA_STORE = "postgres";
  process.env.USE_MOCK_AI = "true";
  process.env.GEMINI_API_KEY = "";
  process.env.GOOGLE_API_KEY = "";
});
vi.mock("../src/modules/auth/authService.js", () => ({
  getCurrentUser: vi.fn(async (req) => req.headers["x-test-user"]
    ? { id: req.headers["x-test-user"], username: "Account" } : undefined),
}));

import { workspaceRoutes } from "../src/api/rest/workspaces.js";
import { PrismaSessionStore } from "../src/database/stores/prismaSessionStore.js";
import { PrismaWorkspaceStore } from "../src/database/stores/prismaWorkspaceStore.js";
import { MemorySessionStore } from "../src/modules/storage/sessionStore.js";
import { MemoryWorkspaceStore } from "../src/modules/workspace/workspaceStore.js";
import { endGuest, expireGuests, GUEST_IDLE_MS, guestStorage } from "../src/modules/storage/guestStorage.js";
import { storageContext } from "../src/modules/storage/context.js";
import { workspaces } from "../src/modules/workspace/workspaceStore.js";

const app = Fastify();
const spies: ReturnType<typeof vi.spyOn>[] = [];
const guest = { "x-guest-session": "guest-session-test-one" };
const other = { "x-guest-session": "guest-session-test-two" };

beforeAll(async () => {
  // Exercise production routing, replacing only actual DB operations with spies.
  for (const [prototype, memory] of [
    [PrismaSessionStore.prototype, new MemorySessionStore()],
    [PrismaWorkspaceStore.prototype, new MemoryWorkspaceStore()],
  ] as const) {
    for (const key of Object.getOwnPropertyNames(prototype)) {
      if (key === "constructor") continue;
      spies.push(vi.spyOn(prototype as any, key).mockImplementation((...args: unknown[]) =>
        (memory as any)[key](...args)));
    }
  }
  await app.register(workspaceRoutes, { prefix: "/api" });
  await app.ready();
});
beforeEach(() => {
  endGuest(guest["x-guest-session"]);
  endGuest(other["x-guest-session"]);
  vi.clearAllMocks();
});
afterAll(async () => { await app.close(); vi.restoreAllMocks(); });

async function create(headers = guest) {
  const response = await app.inject({ method: "POST", url: "/api/workspaces", headers });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}

async function waitFor(url: string, ready: (body: any) => boolean) {
  for (let i = 0; i < 200; i++) {
    const response = await app.inject({ method: "GET", url, headers: guest });
    if (response.statusCode === 200 && ready(response.json())) return response.json();
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out: ${url}`);
}

it("keeps guest drafts, AI turns, chat and evaluations entirely out of persistent stores", async () => {
  const id = await create();
  const url = `/api/workspaces/${id}`;
  expect((await app.inject({ method: "PUT", url: `${url}/draft`, headers: guest,
    payload: { snapshot: { shapes: ["temporary"] } } })).statusCode).toBe(200);
  expect((await app.inject({ method: "POST", url: `${url}/checkpoints`, headers: guest,
    payload: { snapshotImage: "iVBORw0KGgo=", snapshotMime: "image/png", whiteboardSnapshot: {} } })).statusCode).toBe(201);
  await waitFor(`${url}/checkpoints`, (rows) => rows.some((row: any) => row.learnerResponse));
  expect((await app.inject({ method: "POST", url: `${url}/messages`, headers: guest,
    payload: { content: "Photosynthesis uses sunlight." } })).statusCode).toBe(201);
  await waitFor(`${url}/messages`, (rows) => rows.length >= 3);
  expect((await app.inject({ method: "POST", url: `${url}/finish`, headers: guest })).statusCode).toBe(204);
  await waitFor(`${url}/report`, (body) => Boolean(body.letter));
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});

it("isolates guests and discards the workspace when the guest session ends", async () => {
  const id = await create();
  expect((await app.inject({ method: "GET", url: `/api/workspaces/${id}`, headers: other })).statusCode).toBe(404);
  expect((await app.inject({ method: "POST", url: "/api/guest-session/end", headers: guest })).statusCode).toBe(204);
  expect((await app.inject({ method: "GET", url: "/api/workspaces", headers: guest })).json()).toEqual([]);
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});

it("serves guest PDF/audio from memory without requiring custom element headers", async () => {
  const id = await create();
  await storageContext.run(guestStorage(guest["x-guest-session"]), async () => {
    await workspaces.savePdf(id, { data: Buffer.from("temporary pdf"), mime: "application/pdf" });
    await workspaces.saveAudioClip(id, "clip", { data: Buffer.from("audio"), mime: "audio/wav" });
  });
  expect((await app.inject(`/api/workspaces/${id}/pdf`)).body).toBe("temporary pdf");
  const audio = await app.inject(`/api/workspaces/${id}/audio/clip`);
  expect(audio.body).toBe("audio");
  expect(audio.headers["cache-control"]).toBe("no-store");
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});

it("expires abandoned sessions and prevents late jobs from falling back to the database", async () => {
  const id = await create();
  const context = guestStorage(guest["x-guest-session"]);
  expireGuests(Date.now() + GUEST_IDLE_MS);
  await storageContext.run(context, async () => {
    await expect(workspaces.get(id)).rejects.toThrow("Guest session ended");
  });
  expect((await app.inject({ method: "GET", url: "/api/workspaces", headers: guest })).json()).toEqual([]);
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});

it("persists authenticated workspaces while explicit guest mode overrides a login cookie", async () => {
  const [account, temporary] = await Promise.all([
    app.inject({ method: "POST", url: "/api/workspaces", headers: { "x-test-user": "usr_test" } }),
    app.inject({ method: "POST", url: "/api/workspaces", headers: { ...guest, "x-test-user": "usr_test" } }),
  ]);
  expect(account.statusCode).toBe(201);
  expect(temporary.statusCode).toBe(201);
  expect(PrismaWorkspaceStore.prototype.create).toHaveBeenCalledTimes(1);
  expect(PrismaSessionStore.prototype.saveSession).toHaveBeenCalledTimes(1);
  expect((await app.inject({ method: "GET", url: "/api/workspaces", headers: { "x-test-user": "usr_test" } })).json().map((ws: any) => ws.id)).toEqual([account.json().id]);
});

it("rejects unauthenticated writes without an explicit guest session", async () => {
  expect((await app.inject({ method: "POST", url: "/api/workspaces", headers: { "x-client-id": "old-device" } })).statusCode).toBe(401);
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});
