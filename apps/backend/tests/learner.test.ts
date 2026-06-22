/**
 * Learner agent tests (Architecture Document §3.6, §6.7, §6.8).
 *
 * These exercise the deterministic fallback and a fake-LLM mapping. They also
 * guard the core invariant surface: the Learner produces only student-role
 * responses and seeds state from common misconceptions.
 */

import { describe, expect, it } from "vitest";

import { LearnerAgent, seedLearnerState } from "../src/agents/index.js";
import type { VisionInterpretation } from "../src/contracts/board.js";
import type { LearnerState } from "../src/contracts/learner.js";
import type { LLM, StructuredArgs } from "../src/llm/index.js";

const STUDENT_TYPES = ["question", "confusion", "acknowledgment", "paraphrase"];
const DERIVED = ["gap", "misconception", "new_info"];

function interp(text: string): VisionInterpretation {
  return {
    snapshotId: "snap_1",
    transcribedText: text,
    elements: [],
    confidence: 1.0,
    needsConfirmation: false,
  };
}

describe("learner agent", () => {
  it("seeds state from misconceptions only", () => {
    const state = seedLearnerState(
      "ses_1",
      ["O2 comes from CO2", "the dark reactions need darkness"],
      { topicTitle: "Photosynthesis" },
    );
    expect(state.understoodConcepts).toEqual([]);
    expect(state.activeMisconceptions).toHaveLength(2);
    expect(state.activeMisconceptions[0].belief).toBe("O2 comes from CO2");
    expect(state.updatedAtTurn).toBe(0);
  });

  it("fallback stays in the student role", async () => {
    const agent = new LearnerAgent(null); // no LLM -> deterministic fallback
    const state = seedLearnerState("ses_1", ["O2 comes from CO2"], {
      topicTitle: "Photosynthesis",
    });
    const [response, newState] = await agent.respond({
      topicTitle: "Photosynthesis",
      topicDescription: "How plants make food.",
      interpretation: interp("Plants take in CO2 and release O2."),
      speech: null,
      state,
      turnIndex: 0,
    });
    expect(STUDENT_TYPES).toContain(response.type);
    expect(DERIVED).toContain(response.derivedFrom);
    expect(response.text.trim()).toBeTruthy();
    expect(newState.updatedAtTurn).toBe(0);
  });

  it("records the fallback question in state", async () => {
    const agent = new LearnerAgent(null);
    // No misconceptions, one gap -> fallback asks a question about the gap.
    const state: LearnerState = {
      sessionId: "ses_1",
      understoodConcepts: [],
      activeMisconceptions: [],
      openGaps: ["the Calvin cycle"],
      questionsAsked: [],
      updatedAtTurn: 0,
    };
    const [response, newState] = await agent.respond({
      topicTitle: "Photosynthesis",
      topicDescription: "",
      interpretation: interp("..."),
      speech: null,
      state,
      turnIndex: 2,
    });
    expect(response.type).toBe("question");
    expect(newState.questionsAsked).toContain(response.text);
    expect(newState.updatedAtTurn).toBe(2);
  });

  it("maps a structured LLM payload to contracts", async () => {
    const payload = {
      response: {
        type: "question",
        text: "If O2 comes from CO2, why do we need water at all?",
        targetConcept: "source of oxygen",
        derivedFrom: "misconception",
      },
      understoodConcepts: ["plants need light"],
      activeMisconceptions: [{ concept: "source of oxygen", belief: "O2 comes from CO2" }],
      openGaps: ["the Calvin cycle"],
    };

    const calls: StructuredArgs[] = [];
    const fakeLlm: LLM = {
      async structured(args) {
        calls.push(args);
        return payload;
      },
    };

    const agent = new LearnerAgent(fakeLlm);
    const state = seedLearnerState("ses_1", ["O2 comes from CO2"], {
      topicTitle: "Photosynthesis",
    });
    const [response, newState] = await agent.respond({
      topicTitle: "Photosynthesis",
      topicDescription: "How plants make food.",
      interpretation: interp("Plants release O2."),
      speech: null,
      state,
      turnIndex: 3,
    });

    expect(calls).toHaveLength(1);
    expect(response.type).toBe("question");
    expect(response.text).toBe(payload.response.text);
    expect(response.targetConcept).toBe("source of oxygen");
    expect(response.derivedFrom).toBe("misconception");
    expect(newState.understoodConcepts).toEqual(["plants need light"]);
    expect(newState.activeMisconceptions[0]).toEqual({
      concept: "source of oxygen",
      belief: "O2 comes from CO2",
    });
    expect(newState.openGaps).toEqual(["the Calvin cycle"]);
    expect(newState.questionsAsked).toContain(response.text);
    expect(newState.updatedAtTurn).toBe(3);
  });
});
