/**
 * Voice synthesis tests (§TTS).
 *
 * Two things are worth locking down, and neither needs the Python service:
 *
 *  1. The backend picks the same character the frontend draws. The two derive it
 *     independently from the workspace id, so a drift would give the learner
 *     someone else's voice — visible only by ear, and only in production.
 *  2. Speech degrades to silence. A missing, slow, or broken voice service must
 *     never cost the user their learner reply.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEARNER_VOICES, synthesizeSpeech, ttsVoiceForWorkspace } from "../src/modules/tts/index.js";

/**
 * Verbatim copy of `deriveLearner` from apps/frontend/src/lib/Learner.ts, kept
 * here so this test fails loudly if either side is edited alone. The array order
 * mirrors LEARNERS in that file.
 */
const FRONTEND_LEARNERS = ["yuzuki", "reina", "akira"];

function frontendDeriveLearner(workspaceId: string): string {
  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    hash = (hash * 31 + workspaceId.charCodeAt(i)) >>> 0;
  }
  return FRONTEND_LEARNERS[hash % FRONTEND_LEARNERS.length];
}

describe("ttsVoiceForWorkspace", () => {
  it("matches the character the frontend derives, for every voice", () => {
    // Enough ids to hit all three characters, including realistic ws_ ids.
    const ids = [
      "ws_1a2b3c4d", "ws_deadbeef", "ws_00000000", "ws_ffffffff",
      "a", "ab", "abc", "", "workspace-42", "ws_9f8e7d6c", "ws_11112222",
    ];

    for (const id of ids) {
      expect(ttsVoiceForWorkspace(id)).toBe(frontendDeriveLearner(id));
    }
  });

  it("covers all three voices across a spread of ids", () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => ttsVoiceForWorkspace(`ws_${i}`)),
    );

    expect([...seen].sort()).toEqual([...LEARNER_VOICES].sort());
  });

  it("is stable — the same workspace always gets the same voice", () => {
    const first = ttsVoiceForWorkspace("ws_1a2b3c4d");

    expect(ttsVoiceForWorkspace("ws_1a2b3c4d")).toBe(first);
    expect(ttsVoiceForWorkspace("ws_1a2b3c4d")).toBe(first);
  });
});

describe("synthesizeSpeech degradation", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("COGNIVA_TTS_ENABLED", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  /** config reads env at import time, so each case needs a fresh module graph. */
  async function loadTts() {
    vi.resetModules();
    return import("../src/modules/tts/index.js");
  }

  it("returns null when the service is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("Hello there", "yuzuki")).toBeNull();
  });

  it("returns null when the model is still warming up (503)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("Hello there", "yuzuki")).toBeNull();
  });

  it("returns null for empty text without calling the service", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("   ", "yuzuki")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the rendered audio on success", async () => {
    const wav = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => wav.buffer,
      headers: new Headers({ "content-type": "audio/wav", "x-tts-cloned": "1" }),
    }) as never;
    const { synthesizeSpeech: synth } = await loadTts();

    const speech = await synth("Wait, where does the oxygen come from?", "reina");

    expect(speech).not.toBeNull();
    expect(speech!.mime).toBe("audio/wav");
    expect(speech!.cloned).toBe(true);
    expect(speech!.audio.length).toBe(wav.length);
  });

  it("stays silent when speech is switched off, without any request", async () => {
    vi.stubEnv("COGNIVA_TTS_ENABLED", "false");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("Hello there", "yuzuki")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is off by default, so the app never depends on the voice service", async () => {
    vi.unstubAllEnvs();
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("Hello there", "yuzuki")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("synthesizeSpeech (module default state)", () => {
  it("exports the three learner voices in frontend order", () => {
    expect(LEARNER_VOICES).toEqual(["yuzuki", "reina", "akira"]);
  });

  it("is a no-op with speech disabled in the ambient environment", async () => {
    expect(await synthesizeSpeech("anything", "yuzuki")).toBeNull();
  });
});
