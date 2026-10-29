/**
 * Voice synthesis tests (§TTS).
 *
 * Two things are worth locking down, and neither needs the Python service:
 *
 *  1. The backend speaks in the character the frontend draws. Both sides resolve
 *     it independently, so a drift gives the learner someone else's voice —
 *     noticeable only by ear, and only in production.
 *
 *     This test used to compare against `deriveLearner` alone, which is the
 *     id-derived DEFAULT. That was right until the picker let the user override
 *     it, after which the test kept passing while a workspace showing Yuzuki
 *     spoke as Akira. It now mirrors `resolveLearner` — pick first, hash second
 *     — which is what actually decides the face on screen.
 *  2. Speech degrades to silence. A missing, slow, or broken voice service must
 *     never cost the user their learner reply.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEARNER_VOICES,
  synthesizeSpeech,
  ttsVoiceForWorkspace,
  voiceForWorkspace,
} from "../src/modules/tts/index.js";

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

/**
 * Verbatim copy of `resolveLearner` from the same file — the function the UI
 * actually renders from. `storedId` stands in for the localStorage pick, which
 * now reaches the backend as `workspace.learnerId`.
 */
function frontendResolveLearner(workspaceId: string, storedId?: string): string {
  const chosen = FRONTEND_LEARNERS.find((id) => id === storedId);
  return chosen ?? frontendDeriveLearner(workspaceId);
}

describe("voiceForWorkspace", () => {
  it("speaks as the character the user picked, not the id-derived default", () => {
    // The regression, exactly: this workspace hashes to akira, and a user who
    // picked Yuzuki heard a man's voice coming out of her.
    expect(ttsVoiceForWorkspace("ws_f94dcc46")).toBe("akira");
    expect(voiceForWorkspace("yuzuki", "ws_f94dcc46")).toBe("yuzuki");
  });

  it("matches what the frontend renders, picked or not", () => {
    const ids = ["ws_1a2b3c4d", "ws_deadbeef", "ws_f94dcc46", "ws_00000000", "workspace-42"];

    for (const id of ids) {
      // Nobody picked: both sides fall back to the hash.
      expect(voiceForWorkspace(undefined, id)).toBe(frontendResolveLearner(id));

      // Somebody picked: the pick wins on both sides, whichever it was.
      for (const picked of LEARNER_VOICES) {
        expect(voiceForWorkspace(picked, id)).toBe(frontendResolveLearner(id, picked));
      }
    }
  });

  it("falls back rather than throwing on an id it does not recognize", () => {
    // Arrives straight from a client, so it can be anything at all. A voice
    // nobody can render must not cost the user their whole teaching turn.
    for (const bad of ["", "  ", "Yuzuki", "sakura", "../etc/passwd", "yuzuki "]) {
      expect(voiceForWorkspace(bad, "ws_1a2b3c4d")).toBe(ttsVoiceForWorkspace("ws_1a2b3c4d"));
    }
  });
});

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

describe("synthesizeSpeech degradation (no voice configured)", () => {
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

  it("returns null for empty text without calling the service", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("   ", "yuzuki")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("makes no request at all with no key, however loudly speech is enabled", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("Wait, where does the oxygen come from?", "reina")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
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

/**
 * The hosted engine (modules/tts/elevenlabs.ts).
 *
 * Same contract as the local one: never throws, falls silent instead. On top of
 * that, these pin the three things a wrong call would get subtly wrong — the
 * voice id in the path, the key in the header, and the session's language.
 */
describe("ElevenLabs engine", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", "sk_test_key");
    vi.stubEnv("COGNIVA_ELEVENLABS_VOICE_REINA", "voice_reina");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function loadTts() {
    vi.resetModules();
    return import("../src/modules/tts/index.js");
  }

  /** An mp3-shaped answer, as the API sends one. */
  function okAudio() {
    const mp3 = new Uint8Array([255, 251, 144, 68, 0, 0, 0, 0]);
    return vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => mp3.buffer,
      headers: new Headers({ "content-type": "audio/mpeg" }),
    });
  }

  function requestOf(fetchSpy: ReturnType<typeof vi.fn>) {
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return {
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string) as Record<string, unknown>,
    };
  }

  it("turns the voice on by itself once a key is configured", async () => {
    const fetchSpy = okAudio();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    // No COGNIVA_TTS_ENABLED anywhere: the key is the intent.
    const speech = await synth("Wait, where does the oxygen come from?", "reina");

    expect(speech).not.toBeNull();
    expect(speech!.mime).toBe("audio/mpeg");
    expect(speech!.cloned).toBe(false);
  });

  it("calls the voice the character was assigned, with the key in the header", async () => {
    const fetchSpy = okAudio();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    await synth("Hmm, so how come?", "reina");
    const { url, headers, body } = requestOf(fetchSpy);

    expect(url).toContain("/v1/text-to-speech/voice_reina");
    expect(url).toContain("output_format=mp3_44100_128");
    expect(headers["xi-api-key"]).toBe("sk_test_key");
    expect(body.model_id).toBe("eleven_multilingual_v2");
    expect(body.text).toBe("Hmm, so how come?");
  });

  it("sends the neighbouring sentences so the clips do not read as separate takes", async () => {
    const fetchSpy = okAudio();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    await synth("And the second part?", "reina", "en", {
      previous: "Okay, I follow the first part.",
      next: "That is what I am stuck on.",
    });
    const { body } = requestOf(fetchSpy);

    expect(body.previous_text).toBe("Okay, I follow the first part.");
    expect(body.next_text).toBe("That is what I am stuck on.");
  });

  it("lets the model read the language off the text by default, on any model", async () => {
    // The session can be Indonesian while the text is English (every fallback
    // line is): forcing "id" would read English words with Indonesian sounds.
    for (const model of ["eleven_multilingual_v2", "eleven_flash_v2_5", "eleven_v4"]) {
      vi.stubEnv("COGNIVA_ELEVENLABS_MODEL", model);
      const fetchSpy = okAudio();
      globalThis.fetch = fetchSpy as never;
      const { synthesizeSpeech: synth } = await loadTts();

      await synth("I'm still a bit confused. Could you explain that part again?", "reina", "id");

      expect(requestOf(fetchSpy).body).not.toHaveProperty("language_code");
    }
  });

  it("forces the session's language only when that is switched on", async () => {
    vi.stubEnv("COGNIVA_ELEVENLABS_MODEL", "eleven_flash_v2_5");
    vi.stubEnv("COGNIVA_ELEVENLABS_LANGUAGE_CODE", "true");
    const fetchSpy = okAudio();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    await synth("Jadi oksigennya dari mana?", "reina", "id");
    const { body } = requestOf(fetchSpy);

    expect(body.model_id).toBe("eleven_flash_v2_5");
    expect(body.language_code).toBe("id");
  });

  it("trims configured values, as a container's env vars are not trimmed for us", async () => {
    vi.stubEnv("COGNIVA_ELEVENLABS_MODEL", "  eleven_v4 ");
    vi.stubEnv("COGNIVA_ELEVENLABS_OUTPUT_FORMAT", " mp3_44100_128 ");
    const fetchSpy = okAudio();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    await synth("Hmm, so how come?", "reina");
    const { url, body } = requestOf(fetchSpy);

    expect(body.model_id).toBe("eleven_v4");
    expect(url).toContain("output_format=mp3_44100_128");
  });

  it("names the missing permission of a restricted key instead of calling it rejected", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message: unknown) => {
      errors.push(String(message));
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          detail: {
            status: "missing_permissions",
            message: "The API key you used is missing the permission text_to_speech to execute this operation.",
          },
        }),
    }) as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("Hello there", "reina")).toBeNull();
    const logged = errors.join(" | ");
    expect(logged).toContain('lacks the "text_to_speech" permission');
    expect(logged).not.toContain("rejected");
  });

  it("falls back to the one shared voice id when a character has none", async () => {
    vi.stubEnv("COGNIVA_ELEVENLABS_VOICE_ID", "voice_everyone");
    const fetchSpy = okAudio();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    await synth("Okay okay, go on.", "akira");

    expect(requestOf(fetchSpy).url).toContain("/v1/text-to-speech/voice_everyone");
  });

  it("stays silent, without a request, when no voice id is configured", async () => {
    vi.stubEnv("COGNIVA_ELEVENLABS_VOICE_REINA", "");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("Hello there", "yuzuki")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls silent on a rejected key or a spent quota, rather than failing the turn", async () => {
    for (const status of [401, 402, 429, 422, 500]) {
      vi.resetModules();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: async () => '{"detail":"nope"}',
      }) as never;
      const { synthesizeSpeech: synth } = await loadTts();

      expect(await synth("Hello there", "reina")).toBeNull();
    }
  });

  it("falls silent when the network never answers", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND")) as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("Hello there", "reina")).toBeNull();
  });

  it("is still silent with no key at all, so the app never depends on a voice", async () => {
    vi.unstubAllEnvs();
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as never;
    const { synthesizeSpeech: synth } = await loadTts();

    expect(await synth("Hello there", "reina")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
