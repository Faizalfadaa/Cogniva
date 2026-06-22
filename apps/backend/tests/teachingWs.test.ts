/**
 * End-to-end WebSocket teaching-loop test (Architecture Document §5.1, §7.2).
 *
 * Drives the real app: create -> start -> teach one turn over WebSocket, using
 * the deterministic fallback Learner (no API key needed) so CI never hits the
 * network. This is the M1 deliverable in miniature: "one full teaching turn runs."
 */

import type { AddressInfo } from "node:net";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";

import { buildApp } from "../src/app.js";
import { buildOrchestrator, setOrchestrator } from "../src/orchestrator/index.js";

let app: FastifyInstance;
let httpBase: string;
let wsBase: string;

beforeAll(async () => {
  // Force the LLM-free orchestrator so the turn is deterministic and offline.
  setOrchestrator(buildOrchestrator({ useConfig: false }));
  app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;
  httpBase = `http://127.0.0.1:${port}`;
  wsBase = `ws://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
});

/** A pull-based reader so messages that arrive before we await are not lost. */
function reader(ws: WebSocket): () => Promise<any> {
  const queue: any[] = [];
  const waiters: Array<(value: any) => void> = [];
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    const waiter = waiters.shift();
    if (waiter) waiter(msg);
    else queue.push(msg);
  });
  return () =>
    new Promise<any>((resolve) => {
      const msg = queue.shift();
      if (msg !== undefined) resolve(msg);
      else waiters.push(resolve);
    });
}

function opened(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

async function getJson(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${httpBase}${path}`, init);
  return res.json();
}

describe("teaching loop over WebSocket", () => {
  it("runs one full teaching turn", async () => {
    const topics = await getJson("/api/topics");
    const created = await getJson("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: topics[0].topicId }),
    });
    const sid = created.sessionId;
    const started = await getJson(`/api/sessions/${sid}/start`, { method: "POST" });
    expect(started.status).toBe("TEACHING");

    const ws = new WebSocket(`${wsBase}/ws/sessions/${sid}`);
    const next = reader(ws);
    await opened(ws);

    expect(await next()).toEqual({ type: "state_update", status: "TEACHING" });

    ws.send(
      JSON.stringify({
        type: "teaching_input",
        image: "",
        typedText: "Plants take in carbon dioxide and water and make glucose.",
      }),
    );

    const vision = await next();
    expect(vision.type).toBe("vision_result");
    expect(vision.interpretation.transcribedText).toContain("carbon dioxide");

    const learner = await next();
    expect(learner.type).toBe("learner_message");
    expect(["question", "confusion", "acknowledgment", "paraphrase"]).toContain(
      learner.response.type,
    );
    expect(learner.response.text.trim()).toBeTruthy();

    ws.close();

    const session = await getJson(`/api/sessions/${sid}`);
    expect(session.turnCount).toBe(1);
  });

  it("rejects teaching_input before start", async () => {
    const topics = await getJson("/api/topics");
    const created = await getJson("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: topics[0].topicId }),
    });
    const sid = created.sessionId;

    // Session is in SETUP, not TEACHING -> teaching_input is rejected.
    const ws = new WebSocket(`${wsBase}/ws/sessions/${sid}`);
    const next = reader(ws);
    await opened(ws);

    expect((await next()).status).toBe("SETUP");
    ws.send(JSON.stringify({ type: "teaching_input", image: "", typedText: "hi" }));
    const reply = await next();
    expect(reply.type).toBe("error");
    expect(reply.message).toContain("TEACHING");

    ws.close();
  });
});
