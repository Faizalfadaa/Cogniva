/**
 * focusInterpretation tests — the student's "reread_board" tool (§3.6, §7.3).
 *
 * The tool answers from the interpretation this turn already produced, so
 * there is no LLM call and nothing to mock here.
 */

import { describe, expect, it } from "vitest";

import { focusInterpretation } from "../src/agents/vision/vision.focus.js";
import type { VisionInterpretation } from "../src/contracts/board.js";

function interpretation(
  overrides: Partial<VisionInterpretation> = {},
): VisionInterpretation {
  return {
    snapshotId: "snap_1",
    transcribedText: "Fotosintesis terjadi di kloroplas dan menghasilkan glukosa.",
    elements: [
      { type: "text", content: "Kloroplas menyerap cahaya", confidence: 0.95 },
      { type: "equation", content: "6CO2 + 6H2O -> C6H12O6 + 6O2", confidence: 0.9 },
    ],
    confidence: 0.92,
    needsConfirmation: false,
    ...overrides,
  };
}

describe("focusInterpretation", () => {
  it("returns the elements whose content matches the focus keywords", () => {
    const result = focusInterpretation(interpretation(), "kloroplas");

    expect(result).toContain("Kloroplas menyerap cahaya");
    // The unrelated equation is left out.
    expect(result).not.toContain("C6H12O6");
  });

  it("labels each match with its element type", () => {
    const result = focusInterpretation(interpretation(), "6CO2");
    expect(result).toBe("equation: 6CO2 + 6H2O -> C6H12O6 + 6O2");
  });

  it("falls back to the full transcript when nothing matches", () => {
    const interp = interpretation();
    const result = focusInterpretation(interp, "mitokondria");

    expect(result).toBe(interp.transcribedText);
  });

  it("returns the full transcript when the focus is empty", () => {
    const interp = interpretation();
    expect(focusInterpretation(interp, "")).toBe(interp.transcribedText);
    expect(focusInterpretation(interp, "   ")).toBe(interp.transcribedText);
  });

  it("ignores short filler words rather than matching on them", () => {
    // Words under 3 characters are dropped, so "di" alone leaves no keywords
    // and the whole transcript comes back instead of a bogus match.
    const interp = interpretation();
    expect(focusInterpretation(interp, "di")).toBe(interp.transcribedText);
  });

  it("never returns an empty string, even with nothing to read", () => {
    const blank = interpretation({ transcribedText: "", elements: [] });

    expect(focusInterpretation(blank, "kloroplas").trim()).toBeTruthy();
    expect(focusInterpretation(blank, "").trim()).toBeTruthy();
  });
});
