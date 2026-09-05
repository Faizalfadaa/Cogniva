/**
 * Vision agent tests (Architecture Document §3.4, §6.3, §6.4).
 *
 * Mock mode only (no network, no API key) — exercises the typed-text
 * fallback (§5.3, §6.6), the no-input confirmation path, and the guard's
 * mapping into the official VisionInterpretation contract.
 */

import { describe, expect, it } from "vitest";

import { VisionAgent } from "../src/agents/index.js";
import {
  createFallbackInterpretation,
  normalizeVisionLLMOutput,
  toVisionInterpretation,
} from "../src/agents/vision/vision.guard.js";
import type { BoardSnapshot, Element } from "../src/contracts/board.js";

function snapshot(image = ""): BoardSnapshot {
  return {
    snapshotId: "snap_1",
    sessionId: "ses_1",
    turnIndex: 0,
    image,
    format: "png",
    capturedAt: "2026-06-23T00:00:00Z",
  };
}

describe("VisionAgent.interpret (typed-text fallback, §5.3)", () => {
  it("uses typed text directly with full confidence, no model call", async () => {
    const vision = new VisionAgent({ confidenceThreshold: 0.6 });
    const result = await vision.interpret(snapshot(), "Fotosintesis butuh cahaya", "Fotosintesis");

    expect(result.transcribedText).toBe("Fotosintesis butuh cahaya");
    expect(result.confidence).toBe(1.0);
    expect(result.needsConfirmation).toBe(false);
  });

  it("asks for confirmation when there is neither image nor typed text", async () => {
    const vision = new VisionAgent({ confidenceThreshold: 0.6 });
    const result = await vision.interpret(snapshot(""), undefined, "Fotosintesis");

    expect(result.needsConfirmation).toBe(true);
    expect(result.suggestedClarification).toBeTruthy();
  });

  it("reads an image via the mock model when present and no typed text", async () => {
    const vision = new VisionAgent({ confidenceThreshold: 0.6, useMock: true });
    const result = await vision.interpret(snapshot("ZmFrZS1iYXNlNjQ="), undefined, "Fotosintesis");

    expect(result.snapshotId).toBe("snap_1");
    expect(result.needsConfirmation).toBe(false);
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it("accepts the previous turn's elements as continuity context (§3.4)", async () => {
    const vision = new VisionAgent({ confidenceThreshold: 0.6, useMock: true });
    const previousElements: Element[] = [
      { type: "text", content: "Fotosintesis", confidence: 0.9 },
      { type: "arrow", content: "cahaya -> kloroplas", confidence: 0.8 },
    ];

    const withContext = await vision.interpret(
      snapshot("ZmFrZS1iYXNlNjQ="),
      undefined,
      "Fotosintesis",
      previousElements,
    );
    const without = await vision.interpret(
      snapshot("ZmFrZS1iYXNlNjQ="),
      undefined,
      "Fotosintesis",
    );

    // The context only enriches the prompt; the mock ignores it, so the shape
    // of the result must be unchanged either way.
    expect(withContext).toEqual(without);
    expect(withContext.needsConfirmation).toBe(false);
  });

  it("still reads the board when there is no previous turn to carry over", async () => {
    const vision = new VisionAgent({ confidenceThreshold: 0.6, useMock: true });

    const result = await vision.interpret(
      snapshot("ZmFrZS1iYXNlNjQ="),
      undefined,
      "Fotosintesis",
      undefined,
    );

    expect(result.elements.length).toBeGreaterThan(0);
  });
});

describe("vision.guard mapping (kontrak resmi)", () => {
  it("maps an 'unknown' element down to 'text' but keeps needsConfirmation true", () => {
    // Bukti nyata dari papan3.jpeg (lihat chat): coretan buram dilaporkan
    // sebagai kind:"unknown", confidence:0.3 -- bukan ditebak.
    const raw = normalizeVisionLLMOutput({
      transcript: "Papan tentang fotosintesis...",
      elements: [
        { kind: "text", content: "Fotosintesis", confidence: 1, location: "atas" },
        { kind: "unknown", content: "coretan tidak jelas", confidence: 0.3, location: "kiri bawah" },
      ],
      overallConfidence: 0.95,
      ambiguities: ["coretan tidak terbaca jelas di kiri bawah"],
      needsConfirmation: true,
      confirmationPrompt: "Bisa diperjelas atau diketik?",
    });

    const interpretation = toVisionInterpretation(raw, "snap_papan3", 0.6);

    expect(interpretation.needsConfirmation).toBe(true);
    expect(interpretation.confidence).toBeCloseTo(0.95);
    expect(interpretation.elements[1].type).toBe("text"); // tidak ada "unknown" resmi
    expect(interpretation.elements[1].content).toBe("coretan tidak jelas");
  });

  it("preserves a deliberately wrong equation verbatim (jangan-koreksi, §1.4)", () => {
    // Bukti nyata dari papan2.jpeg: "8O2" ditulis sengaja salah (harusnya 6O2).
    const raw = normalizeVisionLLMOutput({
      transcript: "Persamaan: 6CO2 + 6H2O -> C6H12O6 + 8O2",
      elements: [
        { kind: "equation", content: "6CO2 + 6H2O -> C6H12O6 + 8O2", confidence: 0.95, location: "tengah" },
      ],
      overallConfidence: 0.98,
      ambiguities: [],
      needsConfirmation: false,
    });

    const interpretation = toVisionInterpretation(raw, "snap_papan2", 0.6);

    expect(interpretation.elements[0].content).toContain("8O2");
    expect(interpretation.elements[0].content).not.toContain("6O2");
  });

  it("never throws on a malformed payload, falls back to a safe confirmation", () => {
    const result = createFallbackInterpretation("snap_x");
    expect(result.needsConfirmation).toBe(true);
    expect(result.confidence).toBe(0);
  });

  it("carries each element's own confidence into the official contract", () => {
    const raw = normalizeVisionLLMOutput({
      transcript: "Papan tentang fotosintesis...",
      elements: [
        { kind: "text", content: "Fotosintesis", confidence: 0.98, location: "atas" },
        { kind: "unknown", content: "coretan tidak jelas", confidence: 0.3, location: "kiri bawah" },
      ],
      overallConfidence: 0.9,
      ambiguities: [],
      needsConfirmation: false,
    });

    const interpretation = toVisionInterpretation(raw, "snap_conf", 0.6);

    // This field used to be dropped during mapping. Keeping it means a smudged
    // element stays distinguishable from a clean one even when the board as a
    // whole reads with high confidence.
    expect(interpretation.elements[0].confidence).toBeCloseTo(0.98);
    expect(interpretation.elements[1].confidence).toBeCloseTo(0.3);
  });
});
