/**
 * The student answers in the language the session runs in.
 *
 * When the codebase was translated to English the prompt was left saying
 * "Always answer in English", so a teacher explaining statistics in Indonesian
 * got questions back in English. The workspace already records its language;
 * these tests hold the prompt to it.
 */

import { describe, expect, it } from "vitest";

import { buildLearnerMessages } from "../src/llm/prompts/learner.prompt.js";
import type { LearnerState } from "../src/contracts/learner.js";
import type { Locale } from "../src/contracts/workspace.js";

const state: LearnerState = {
  sessionId: "ses_locale",
  understoodConcepts: [],
  activeMisconceptions: [],
  openGaps: [],
  questionsAsked: [],
  updatedAtTurn: 0,
};

function prompt(locale?: Locale): string {
  return buildLearnerMessages({
    sessionId: "ses_locale",
    turnIndex: 1,
    teachingText:
      "Statistik adalah ilmu yang mempelajari cara generalisasi data sebuah populasi dari data sampel",
    currentState: state,
    locale,
  })
    .map((m) => m.content)
    .join("\n");
}

describe("learner response language", () => {
  it("answers in Indonesian in an Indonesian session", () => {
    const text = prompt("id");
    expect(text).toContain("Always answer in Bahasa Indonesia");
    expect(text).not.toContain("Always answer in English");
  });

  it("answers in English in an English session", () => {
    const text = prompt("en");
    expect(text).toContain("Always answer in English");
    expect(text).not.toContain("Always answer in Bahasa Indonesia");
  });

  it("follows the teacher when no session language is on record", () => {
    const text = prompt();
    expect(text).toContain("the language the teacher is mostly using");
    expect(text).not.toContain("Always answer in English");
  });
});
