/**
 * The student keeps the personality of the character the user picked.
 *
 * The tone used to rotate by turn number (tsundere, kuudere, yandere), so
 * whichever student was picked, the first reply was the tsundere one: Reina
 * and Akira both opened sounding like someone else.
 */

import { describe, expect, it } from "vitest";

import { buildLearnerMessages } from "../src/llm/prompts/learner.prompt.js";
import type { LearnerState } from "../src/contracts/learner.js";

const state: LearnerState = {
  sessionId: "ses_char",
  understoodConcepts: [],
  activeMisconceptions: [],
  openGaps: [],
  questionsAsked: [],
  updatedAtTurn: 0,
};

function prompts(learnerName: string | undefined, turnIndex = 0) {
  const messages = buildLearnerMessages({
    sessionId: "ses_char",
    turnIndex,
    teachingText: "Plants make glucose from light.",
    currentState: state,
    learnerName,
  });
  return {
    system: messages.find((m) => m.role === "system")!.content,
    user: messages.find((m) => m.role === "user")!.content,
  };
}

describe("learner character", () => {
  it("gives Reina her own voice on every turn, never the rotating tones", () => {
    for (const turn of [0, 1, 2, 3]) {
      const { system, user } = prompts("Reina Kisaragi", turn);
      expect(system).toContain("KYAA");
      expect(user).toContain("Reina:");
      expect(system).not.toContain("Tsundere");
      expect(user).not.toContain("Tsundere");
    }
  });

  it("gives Akira and Yuzuki their own voices", () => {
    expect(prompts("Akira Kagetsu").user).toContain("Akira:");
    expect(prompts("Akira Kagetsu").system).toContain("blunt");
    expect(prompts("Yuzuki Akatsuki").user).toContain("Yuzuki:");
    expect(prompts("Yuzuki Akatsuki").system).toContain("E-etto");
  });

  it("keeps the rotating tones for a student with no character", () => {
    expect(prompts(undefined, 0).user).toContain("Tsundere");
    expect(prompts(undefined, 1).user).toContain("Kuudere");
  });
});
