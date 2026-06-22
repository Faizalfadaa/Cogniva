/** Session state-machine tests (Architecture Document §4) — enforce M0 invariants. */

import { describe, expect, it } from "vitest";

import {
  END,
  EVALUATE,
  InvalidTransition,
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

  it("has no backward path", () => {
    // ENDED cannot go back to TEACHING (§4.2).
    expect(canTransition("ENDED", START)).toBe(false);
    expect(() => nextStatus("ENDED", START)).toThrow(InvalidTransition);
  });

  it("treats EVALUATED as terminal", () => {
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
