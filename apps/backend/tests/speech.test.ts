/**
 * Per-sentence learner speech (§TTS).
 *
 * What is worth locking down:
 *
 *  1. How a reply is cut. Sentence boundaries, tiny fragments merged, a cap on
 *     the number of pieces — each piece is a separate render, and a cut in the
 *     wrong place is audible.
 *  2. The contract the UI builds on. Text and a pending plan land together; every
 *     sentence gets its clip; a checkpoint and its chat mirror share one speech
 *     id; a failing voice service ends in "unavailable" with readable text, never
 *     a plan that stays pending forever.
 *  3. Speech off means no plan at all, so the UI never waits for audio that is not
 *     coming.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { speechSegments } from "../src/modules/tts/index.js";

describe("speechSegments", () => {
  it("splits a reply on sentence boundaries", () => {
    expect(
      speechSegments(
        "Wait, so the light reaction happens in the thylakoid? I thought that was the stroma, honestly.",
      ),
    ).toEqual([
      "Wait, so the light reaction happens in the thylakoid?",
      "I thought that was the stroma, honestly.",
    ]);
  });

  it("merges a very short opening sentence into the next one", () => {
    expect(speechSegments("Hmm. So the oxygen comes from the water, not the air?")).toEqual([
      "Hmm. So the oxygen comes from the water, not the air?",
    ]);
  });

  it("folds a short closing sentence into the one before it", () => {
    expect(speechSegments("So the plant stores the sugar for later use. Right?")).toEqual([
      "So the plant stores the sugar for later use. Right?",
    ]);
  });

  it("keeps closing quotes with their sentence", () => {
    expect(
      speechSegments('She said "the stroma makes the sugar." Then what does the thylakoid do exactly?'),
    ).toEqual([
      'She said "the stroma makes the sugar."',
      "Then what does the thylakoid do exactly?",
    ]);
  });

  it("caps the number of pieces without dropping a word", () => {
    const reply = Array.from({ length: 7 }, (_, i) => `This is sentence number ${i + 1} here.`).join(" ");
    const pieces = speechSegments(reply);
    expect(pieces).toHaveLength(4);
    expect(pieces.join(" ")).toBe(reply);
  });

  it("keeps a reply without sentence punctuation whole", () => {
    expect(speechSegments("  so the chlorophyll   catches the light  ")).toEqual([
      "so the chlorophyll catches the light",
    ]);
  });

  it("returns nothing for blank text", () => {
    expect(speechSegments("   ")).toEqual([]);
  });
});

/** A 1x1 PNG is enough — the turn runs on mocks. */
const SNAPSHOT = "iVBORw0KGgo=";
const WAV = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69]);

const renderedClip = () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => WAV.buffer.slice(0),
  headers: new Headers({ "content-type": "audio/wav", "x-tts-cloned": "1" }),
});

/** Answer /synthesize from a fake voice service; fail every other request fast. */
function fakeVoiceService(respond: () => unknown) {
  const fetchMock = vi.fn(async (input: unknown) => {
    if (String(input).includes("/synthesize")) return respond();
    throw new Error("network disabled in this test");
  });
  globalThis.fetch = fetchMock as never;
  return fetchMock;
}

/** config reads the environment at import time, so each case needs a fresh module graph. */
async function loadApp() {
  vi.resetModules();
  const service = await import("../src/modules/workspace/workspaceService.js");
  const { workspaces } = await import("../src/modules/workspace/workspaceStore.js");
  return { service, workspaces };
}

/** The voice lands from a fire-and-forget background job, so poll for it. */
async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await probe();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for the background job");
}

describe("learner speech pipeline", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("COGNIVA_DEMO_MODE", "false");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("publishes the text with a pending plan, then voices every sentence", async () => {
    vi.stubEnv("COGNIVA_TTS_ENABLED", "true");
    fakeVoiceService(renderedClip);
    const { service, workspaces } = await loadApp();

    const ws = await service.createWorkspace();
    const checkpoint = await service.submitCheckpoint(ws.id, {
      snapshotImage: SNAPSHOT,
      snapshotMime: "image/png",
      whiteboardSnapshot: {},
    });

    const done = await waitFor(async () =>
      (await service.getCheckpoints(ws.id))?.find(
        (c) => c.id === checkpoint!.id && c.speech?.status === "ready",
      ),
    );

    const speech = done.speech!;
    expect(speech.segments.length).toBeGreaterThan(0);
    // Nothing is lost between the reply and what gets spoken.
    expect(speech.segments.map((s) => s.text).join(" ")).toBe(
      done.learnerResponse!.replace(/\s+/g, " ").trim(),
    );
    for (const segment of speech.segments) {
      const audioId = segment.audioUrl!.split("/").pop()!;
      expect(await workspaces.getAudioClip(ws.id, audioId)).toBeDefined();
    }

    // The chat mirror shares the speech id, so the UI speaks the line once.
    const mirror = (await service.getChatMessages(ws.id))?.find((m) => m.sender === "learner");
    expect(mirror?.speech?.id).toBe(speech.id);
  });

  it("ends in 'unavailable' with readable text when the voice service fails", async () => {
    vi.stubEnv("COGNIVA_TTS_ENABLED", "true");
    fakeVoiceService(() => ({ ok: false, status: 503 }));
    const { service } = await loadApp();

    const ws = await service.createWorkspace();
    await service.submitCheckpoint(ws.id, {
      snapshotImage: SNAPSHOT,
      snapshotMime: "image/png",
      whiteboardSnapshot: {},
    });

    const stopped = await waitFor(async () =>
      (await service.getCheckpoints(ws.id))?.find((c) => c.speech?.status === "unavailable"),
    );
    expect(stopped.learnerResponse).toBeTruthy();
    expect(stopped.speech!.segments.every((s) => !s.audioUrl)).toBe(true);
  });

  it("adds no speech plan when the voice is switched off", async () => {
    vi.stubEnv("COGNIVA_TTS_ENABLED", "false");
    const fetchMock = fakeVoiceService(renderedClip);
    const { service } = await loadApp();

    const ws = await service.createWorkspace();
    await service.submitCheckpoint(ws.id, {
      snapshotImage: SNAPSHOT,
      snapshotMime: "image/png",
      whiteboardSnapshot: {},
    });

    const reply = await waitFor(async () =>
      (await service.getCheckpoints(ws.id))?.find((c) => c.learnerResponse),
    );
    expect(reply.speech).toBeUndefined();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/synthesize"))).toBe(false);
  });

  it("voices a chat reply the same way", async () => {
    vi.stubEnv("COGNIVA_TTS_ENABLED", "true");
    fakeVoiceService(renderedClip);
    const { service } = await loadApp();

    const ws = await service.createWorkspace();
    await service.sendChatMessage(ws.id, "The oxygen comes from the water, not the air.");

    const spoken = await waitFor(async () =>
      (await service.getChatMessages(ws.id))?.find(
        (m) => m.sender === "learner" && m.speech?.status === "ready",
      ),
    );
    expect(spoken.speech!.segments.every((s) => s.audioUrl)).toBe(true);
  });
});
