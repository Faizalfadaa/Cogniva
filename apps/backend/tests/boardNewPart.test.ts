/**
 * The student has to know which part of the board is new.
 *
 * Every Teach sends the whole board, so the board reading holds everything ever
 * written on it. Handed over as one block, all of it read as what the teacher
 * just explained, and the student kept asking about material the lesson had
 * already moved past. These cover the three pieces that fix that: the new part
 * is read on its own, the student is shown it apart from the rest, and old gaps
 * make way for new ones instead of steering every question.
 */

import { describe, expect, it } from "vitest";

import { composeTeachingText } from "../src/agents/learner/index.js";
import { buildEvaluatorMessages } from "../src/agents/evaluator/evaluator.prompt.js";
import { normalizeEvaluation } from "../src/agents/evaluator/evaluator.guard.js";
import { byRecency, MAX_OPEN_GAPS, normalizeLearnerOutput } from "../src/agents/learner/learner.guard.js";
import type { BoardSnapshot, Element, VisionInterpretation } from "../src/contracts/board.js";
import { utcNowIso } from "../src/contracts/common.js";
import type { LearnerResponse, LearnerState } from "../src/contracts/learner.js";
import type { Session } from "../src/contracts/session.js";
import { Orchestrator, type Learner, type Vision } from "../src/orchestrator/index.js";
import { newId, sessions } from "../src/modules/storage/sessionStore.js";
import { topics } from "../src/modules/topic/repository.js";

/** Reads "the board" by echoing the image it was given, and records each call. */
class RecordingVision implements Vision {
  calls: { image: string; previousElements: Element[] | undefined }[] = [];
  failOn?: string;

  async interpret(
    snapshot: BoardSnapshot,
    _typedText: string | null | undefined,
    _topic?: string,
    previousElements?: Element[],
  ): Promise<VisionInterpretation> {
    this.calls.push({ image: snapshot.image, previousElements });
    if (snapshot.image === this.failOn) throw new Error("vision down");
    return {
      snapshotId: snapshot.snapshotId,
      transcribedText: `read:${snapshot.image}`,
      elements: [{ type: "text", content: snapshot.image, confidence: 1 }],
      confidence: 1,
      needsConfirmation: false,
    };
  }
}

/** Records the board reading each turn handed to the student. */
class RecordingLearner implements Learner {
  seen: VisionInterpretation[] = [];

  async respond({
    interpretation,
    state,
    turnIndex,
  }: {
    interpretation: VisionInterpretation;
    state: LearnerState;
    turnIndex: number;
  }): Promise<[LearnerResponse, LearnerState]> {
    this.seen.push(interpretation);
    const response: LearnerResponse = {
      responseId: newId("resp"),
      turnIndex,
      type: "question",
      text: `question ${turnIndex}`,
      targetConcept: null,
      derivedFrom: "new_info",
    };
    return [response, { ...state, updatedAtTurn: turnIndex }];
  }
}

async function newSession(): Promise<Session> {
  return sessions.saveSession({
    sessionId: newId("ses"),
    topicId: "topic_photosynthesis",
    status: "TEACHING",
    createdAt: utcNowIso(),
    turnCount: 0,
    tokensUsed: 0,
    evaluationIds: [],
  });
}

function setup() {
  const vision = new RecordingVision();
  const learner = new RecordingLearner();
  const orchestrator = new Orchestrator({ learner, vision });
  const topic = topics.get("topic_photosynthesis")!;
  return { vision, learner, orchestrator, topic };
}

describe("reading the new part of the board", () => {
  it("reads the whole board and, separately, only what changed", async () => {
    const { vision, learner, orchestrator, topic } = setup();
    const session = await newSession();

    await orchestrator.runTeachingTurn(session, topic, {
      image: "boardA",
      typedText: null,
      allowConfirmation: false,
    });
    vision.calls = [];

    await orchestrator.runTeachingTurn(session, topic, {
      image: "boardAB",
      typedText: null,
      allowConfirmation: false,
      newImage: "partB",
    });

    // The whole board first, with last turn's elements for continuity; then
    // the new part alone, with nothing about what used to be there.
    expect(vision.calls.map((c) => c.image)).toEqual(["boardAB", "partB"]);
    expect(vision.calls[0].previousElements).toBeDefined();
    expect(vision.calls[1].previousElements).toBeUndefined();

    const handed = learner.seen[1];
    expect(handed.transcribedText).toBe("read:boardAB");
    expect(handed.newText).toBe("read:partB");

    // Stored with the turn, so it is there for anything that reads it later.
    const [, secondTurn] = await sessions.listTurns(session.sessionId);
    expect(secondTurn.interpretation.newText).toBe("read:partB");
  });

  it("marks the first reading of a board as all new by leaving newText out", async () => {
    const { learner, orchestrator, topic } = setup();
    const session = await newSession();

    await orchestrator.runTeachingTurn(session, topic, {
      image: "boardA",
      typedText: null,
      allowConfirmation: false,
    });

    expect(learner.seen[0].newText).toBeUndefined();
  });

  it("says nothing is new when the board did not change, instead of repeating last turn", async () => {
    const { vision, learner, orchestrator, topic } = setup();
    const session = await newSession();

    await orchestrator.runTeachingTurn(session, topic, {
      image: "boardA",
      typedText: null,
      allowConfirmation: false,
      newImage: "partA",
    });
    vision.calls = [];

    // Same board again: the reading is carried over without calling Vision,
    // and whatever was new last turn is not new any more.
    await orchestrator.runTeachingTurn(session, topic, {
      image: "boardA",
      typedText: null,
      allowConfirmation: false,
    });

    expect(vision.calls).toHaveLength(0);
    expect(learner.seen[1].newText).toBe("");
  });

  it("still teaches from the whole board when reading the new part fails", async () => {
    const { vision, learner, orchestrator, topic } = setup();
    const session = await newSession();
    vision.failOn = "partB";

    await orchestrator.runTeachingTurn(session, topic, {
      image: "boardA",
      typedText: null,
      allowConfirmation: false,
    });
    const result = await orchestrator.runTeachingTurn(session, topic, {
      image: "boardAB",
      typedText: null,
      allowConfirmation: false,
      newImage: "partB",
    });

    expect(result.kind).toBe("learner");
    expect(learner.seen[1].transcribedText).toBe("read:boardAB");
    expect(learner.seen[1].newText).toBeUndefined();
  });
});

describe("what the student is told this turn", () => {
  const reading = (transcribedText: string, newText?: string): VisionInterpretation => ({
    snapshotId: "s",
    transcribedText,
    elements: [],
    confidence: 1,
    needsConfirmation: false,
    newText,
  });
  const speech = (transcript: string) =>
    ({ transcript }) as unknown as Parameters<typeof composeTeachingText>[1];

  it("puts what was just drawn first, and labels the rest as earlier material", () => {
    const text = composeTeachingText(
      reading("Light reactions\nCalvin cycle", "Calvin cycle"),
      speech("Now the carbon gets fixed"),
    );

    expect(text.indexOf("Just added to the board this turn:\nCalvin cycle")).toBe(0);
    expect(text).toContain("Said out loud this turn:\nNow the carbon gets fixed");
    expect(text).toContain("including earlier material");
    expect(text.indexOf("Light reactions")).toBeGreaterThan(text.indexOf("Said out loud"));
  });

  it("says plainly when nothing new was drawn", () => {
    expect(composeTeachingText(reading("Light reactions", ""), speech("Let me say it again"))).toContain(
      "(nothing new was drawn on the board this turn)",
    );
  });

  it("keeps the single block when there is nothing to compare against", () => {
    expect(composeTeachingText(reading("Light reactions"), speech("Plants use light"))).toBe(
      "Light reactions\n\nPlants use light",
    );
  });
});

describe("old gaps make way for new ones", () => {
  it("orders gaps oldest first, whatever order the model returns them in", () => {
    expect(byRecency(["new one", "b", "a"], ["a", "b"])).toEqual(["a", "b", "new one"]);
  });

  it(`keeps only the ${MAX_OPEN_GAPS} most recent, dropping the oldest`, () => {
    const previous = ["g1", "g2", "g3", "g4", "g5"];
    const output = normalizeLearnerOutput(
      {
        nextState: { openGaps: ["g6", "g1", "g2", "g3", "g4", "g5"] },
        response: { type: "question", text: "What is g6?", derivedFrom: "gap" },
      } as never,
      {
        sessionId: "s",
        turnIndex: 3,
        teachingText: "g6",
        currentState: {
          sessionId: "s",
          understoodConcepts: [],
          activeMisconceptions: [],
          openGaps: previous,
          questionsAsked: [],
          updatedAtTurn: 2,
        },
      } as never,
    );

    expect(output.nextState.openGaps).toEqual(["g2", "g3", "g4", "g5", "g6"]);
  });
});

describe("the evaluator sees where each concept was introduced", () => {
  const turns = [
    { turnIndex: 0, boardText: "Water is split", newBoardText: undefined },
    { turnIndex: 1, boardText: "Water is split. RuBisCO fixes CO2", newBoardText: "RuBisCO fixes CO2" },
  ];

  it("shows the evaluator what each turn added", () => {
    const [, user] = buildEvaluatorMessages({
      sessionId: "s",
      turns,
      referenceMaterial: "ref",
      keyConcepts: [],
      commonMisconceptions: [],
    });
    expect(user.content).toContain("New on the board this turn: RuBisCO fixes CO2");
  });

  it("accepts a quote taken from the new part", () => {
    const result = normalizeEvaluation(
      {
        depthScore: 40,
        findings: [{ category: "CORRECT", concept: "carbon fixation", detail: "ok", evidenceTurnIndex: 1, sourceQuote: "RuBisCO fixes CO2" }],
      },
      "s",
      "e",
      turns,
    );
    expect(result.findings[0].sourceQuote).toBe("RuBisCO fixes CO2");
  });
});
