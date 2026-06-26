/** Session state-machine tests (Architecture Document §4) — enforce M0 invariants. */

import { describe, expect, it } from "vitest";

import {
  END,
  EVALUATE,
  InvalidTransition,
  RESUME,
  START,
  acceptsTeachingInput,
  canTransition,
  nextStatus,
} from "../src/modules/session/stateMachine.js";

describe("session state machine", () => {
  it("follows the full forward path", () => {
    let s = nextStatus("SETUP", START);
    expect(s).toBe("TEACHING");
    s = nextStatus(s, END);
    expect(s).toBe("ENDED");
    s = nextStatus(s, EVALUATE);
    expect(s).toBe("EVALUATED");
  });

  it("resumes a finished session back to TEACHING", () => {
    // Agreed extension: EVALUATED/ENDED -> TEACHING via resume.
    expect(nextStatus("EVALUATED", RESUME)).toBe("TEACHING");
    expect(nextStatus("ENDED", RESUME)).toBe("TEACHING");
    // A full cycle: teach -> end -> evaluate -> resume -> teach again.
    const cycled = nextStatus(nextStatus("EVALUATED", RESUME), END);
    expect(cycled).toBe("ENDED");
  });

  it("still rejects non-resume backward moves", () => {
    // resume is the ONLY way back; START/EVALUATE from ENDED stay invalid.
    expect(canTransition("ENDED", START)).toBe(false);
    expect(() => nextStatus("ENDED", START)).toThrow(InvalidTransition);
  });

  it("EVALUATED only transitions via resume (no longer terminal)", () => {
    expect(canTransition("EVALUATED", RESUME)).toBe(true);
    for (const event of [START, END, EVALUATE]) {
      expect(canTransition("EVALUATED", event)).toBe(false);
    }
  });

  it("only evaluates from ENDED", () => {
    expect(canTransition("ENDED", EVALUATE)).toBe(true);
    expect(canTransition("TEACHING", EVALUATE)).toBe(false);
    expect(canTransition("SETUP", EVALUATE)).toBe(false);
  });

  it("only accepts teaching_input while TEACHING", () => {
    expect(acceptsTeachingInput("TEACHING")).toBe(true);
    expect(acceptsTeachingInput("SETUP")).toBe(false);
    expect(acceptsTeachingInput("ENDED")).toBe(false);
    expect(acceptsTeachingInput("EVALUATED")).toBe(false);
  });
});
