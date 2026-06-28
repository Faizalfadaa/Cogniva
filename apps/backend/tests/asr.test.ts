/**
 * ASR agent tests (Architecture Document §3.5, §6.5).
 *
 * Mock mode only (no network, no API key) — exercises the typed-text fallback
 * (§5.3), the no-audio path, and the guard's mapping into the official
 * SpeechTranscript contract.
 */

import { describe, expect, it } from "vitest";

import { AsrAgent } from "../src/agents/asr/index.js";
import {
  createFallbackTranscript,
  normalizeAsrLLMOutput,
  toSpeechTranscript,
} from "../src/agents/asr/asr.guard.js";
import type { AsrAgentInput, AudioClip } from "../src/agents/asr/asr.types.js";

function clip(audio = ""): AudioClip {
  return {
    segmentId: "seg_1",
    sessionId: "ses_1",
    turnIndex: 0,
    audio,
    format: "webm",
    capturedAt: "2026-06-25T00:00:00Z",
  };
}

function input(overrides: Partial<AsrAgentInput> = {}): AsrAgentInput {
  return {
    segmentId: "seg_1",
    sessionId: "ses_1",
    turnIndex: 0,
    topic: "Fotosintesis",
    audioBase64: "ZmFrZQ==",
    mimeType: "audio/webm",
    capturedAt: "2026-06-25T00:00:00Z",
    ...overrides,
  };
}

describe("AsrAgent.transcribe (typed-text fallback, §5.3)", () => {
  it("uses typed text directly with full confidence, no model call", async () => {
    const asr = new AsrAgent({ confidenceThreshold: 0.6 });
    const result = await asr.transcribe(clip(), "Fotosintesis butuh cahaya", "Fotosintesis");

    expect(result.transcript).toBe("Fotosintesis butuh cahaya");
    expect(result.confidence).toBe(1.0);
    expect(result.segmentId).toBe("seg_1");
  });

  it("returns an empty transcript when there is neither audio nor typed text", async () => {
    const asr = new AsrAgent({ confidenceThreshold: 0.6 });
    const result = await asr.transcribe(clip(""), undefined, "Fotosintesis");

    expect(result.transcript).toBe("");
    expect(result.confidence).toBe(0);
  });

  it("transcribes audio via the mock model when present and no typed text", async () => {
    const asr = new AsrAgent({ confidenceThreshold: 0.6, useMock: true });
    const result = await asr.transcribe(clip("ZmFrZS1hdWRpbw=="), undefined, "Fotosintesis");

    expect(result.segmentId).toBe("seg_1");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.transcript).toContain("Fotosintesis");
  });
});

describe("asr.guard mapping (kontrak resmi)", () => {
  it("preserves a deliberately wrong statement verbatim (jangan-koreksi, §1.4)", () => {
    const raw = normalizeAsrLLMOutput({
      transcript: "Air mendidih pada lima puluh derajat celsius",
      confidence: 0.9,
      language: "id-ID",
      ambiguities: [],
    });

    const result = toSpeechTranscript(raw, input());

    expect(result.transcript).toContain("lima puluh derajat");
    expect(result.transcript).not.toContain("seratus");
  });

  it("caps confidence when the model flags ambiguities, so the signal survives", () => {
    const raw = normalizeAsrLLMOutput({
      transcript: "bagian ini ... (tidak jelas)",
      confidence: 0.95,
      language: "id-ID",
      ambiguities: ["kata terakhir tidak terdengar jelas"],
    });

    const result = toSpeechTranscript(raw, input());

    expect(result.confidence).toBeLessThanOrEqual(0.6);
  });

  it("defaults a missing language code to the Indonesian-first fallback", () => {
    const raw = normalizeAsrLLMOutput({
      transcript: "halo",
      confidence: 0.8,
      ambiguities: [],
    });

    expect(raw.language).toBe("id-ID");
  });

  it("never throws on a malformed payload, falls back to an empty transcript", () => {
    const result = createFallbackTranscript(input());
    expect(result.transcript).toBe("");
    expect(result.confidence).toBe(0);
  });
});
