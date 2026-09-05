/**
 * Planner tests (Architecture Document §3.3, solusi S5).
 *
 * Two halves: the rule engine + guard on their own (pure functions, no I/O), and
 * the Orchestrator actually driving a plan — which is where the savings show up
 * as calls that never happen.
 */

import { describe, expect, it, vi } from "vitest";

import { VisionAgent } from "../src/agents/index.js";
import {
  decideStep,
  normalizePlan,
  planWithRules,
  shouldReplan,
  takeFeasible,
  type Plan,
  type TurnSituation,
} from "../src/agents/planner/index.js";
import type { AudioClip } from "../src/agents/asr/asr.types.js";
import type { BoardSnapshot, VisionInterpretation } from "../src/contracts/board.js";
import { utcNowIso } from "../src/contracts/common.js";
import type { LearnerResponse, LearnerState } from "../src/contracts/learner.js";
import type { Session } from "../src/contracts/session.js";
import type { SpeechTranscript } from "../src/contracts/speech.js";
import type { Topic } from "../src/contracts/topic.js";
import { newId, sessions } from "../src/modules/storage/sessionStore.js";
import { Orchestrator, type Asr, type Learner, type Planner } from "../src/orchestrator/index.js";
import { topics } from "../src/modules/topic/repository.js";

// --- fixtures --------------------------------------------------------------

function situation(overrides: Partial<TurnSituation> = {}): TurnSituation {
  return {
    turnIndex: 0,
    hasImage: true,
    hasAudio: false,
    hasTypedText: false,
    hasPreviousBoard: false,
    boardUnchanged: false,
    completed: [],
    boardRead: false,
    boardConfidence: null,
    boardNeedsConfirmation: false,
    boardText: "",
    boardClarification: "",
    audioTranscribed: false,
    speechConfidence: null,
    allowConfirmation: true,
    stepsLeft: 5,
    ...overrides,
  };
}

class FakeLearner implements Learner {
  async respond({
    state,
    turnIndex,
  }: {
    state: LearnerState;
    turnIndex: number;
  }): Promise<[LearnerResponse, LearnerState]> {
    const response: LearnerResponse = {
      responseId: newId("resp"),
      turnIndex,
      type: "question",
      text: "Why does that happen?",
      targetConcept: null,
      derivedFrom: "new_info",
    };
    return [response, { ...state, updatedAtTurn: turnIndex }];
  }
}

class FakeAsr implements Asr {
  calls = 0;
  async transcribe(clip: AudioClip): Promise<SpeechTranscript> {
    this.calls++;
    return {
      segmentId: clip.segmentId,
      sessionId: clip.sessionId,
      turnIndex: clip.turnIndex,
      transcript: "spoken explanation",
      needsConfirmation: false,
      confidence: 0.9,
      language: "id-ID",
      capturedAt: clip.capturedAt,
    };
  }
}

/** Vision that always comes back unsure — the case that used to stall a turn. */
class UnsureVision {
  calls = 0;
  async interpret(snapshot: BoardSnapshot): Promise<VisionInterpretation> {
    this.calls++;
    return {
      snapshotId: snapshot.snapshotId,
      transcribedText: "someth?ng illegible",
      elements: [],
      confidence: 0.3,
      needsConfirmation: true,
      suggestedClarification: "Is that word 'chloroplast'?",
    };
  }
}

/** A planner that hands back a fixed plan — stands in for the model. */
class FixedPlanner implements Planner {
  calls = 0;
  constructor(private readonly fixed: Plan) {}
  async plan(): Promise<Plan> {
    this.calls++;
    return { ...this.fixed, steps: [...this.fixed.steps] };
  }
}

function newSession(): Promise<Session> {
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

function topic(): Topic {
  return topics.get("topic_photosynthesis")!;
}

// --- the rule engine -------------------------------------------------------

describe("planner rules", () => {
  it("reads the board first, then hands the turn to the student", () => {
    const plan = planWithRules(situation());
    expect(plan.steps.map((s) => s.kind)).toEqual(["read_board", "ask_learner"]);
    expect(plan.source).toBe("rules");
  });

  it("schedules ASR only when a clip actually arrived", () => {
    expect(planWithRules(situation({ hasAudio: true })).steps.map((s) => s.kind)).toEqual([
      "read_board",
      "transcribe_audio",
      "ask_learner",
    ]);
    expect(planWithRules(situation()).steps.map((s) => s.kind)).not.toContain(
      "transcribe_audio",
    );
  });

  it("skips Vision when the board has not changed since the previous turn", () => {
    const plan = planWithRules(situation({ hasPreviousBoard: true, boardUnchanged: true }));
    expect(plan.steps[0].kind).toBe("reuse_board");
    expect(plan.steps.map((s) => s.kind)).not.toContain("read_board");
  });

  it("re-reads an unsure board before interrupting the user", () => {
    const unsure = situation({ boardRead: true, boardNeedsConfirmation: true });
    expect(decideStep(unsure).kind).toBe("verify_board");

    const afterVerify = { ...unsure, completed: ["verify_board" as const] };
    expect(decideStep(afterVerify).kind).toBe("ask_confirmation");
  });

  it("proceeds on the best guess when the caller has no confirmation UI", () => {
    const unsure = situation({
      boardRead: true,
      boardNeedsConfirmation: true,
      completed: ["verify_board"],
      allowConfirmation: false,
    });
    expect(decideStep(unsure).kind).toBe("ask_learner");
  });

  it("always reaches a terminal step", () => {
    for (const overrides of [
      {},
      { hasAudio: true },
      { hasImage: false },
      { hasPreviousBoard: true, boardUnchanged: true, hasAudio: true },
      { allowConfirmation: false },
    ]) {
      const steps = planWithRules(situation(overrides)).steps;
      expect(["ask_learner", "ask_confirmation"]).toContain(steps[steps.length - 1].kind);
    }
  });
});

// --- the guard -------------------------------------------------------------

describe("planner guard", () => {
  it("drops unknown steps and gives an unterminated plan an ending", () => {
    const plan = normalizePlan(
      {
        steps: [
          { kind: "read_board", reason: "look at it" },
          { kind: "summon_dragon", reason: "why not" },
          { kind: "read_board", reason: "again" },
        ],
        rationale: "test",
      },
      situation(),
    );

    expect(plan.steps.map((s) => s.kind)).toEqual(["read_board", "ask_learner"]);
    expect(plan.source).toBe("llm");
  });

  it("falls back to the rules when the model returns nothing usable", () => {
    const plan = normalizePlan({ steps: [], rationale: "" }, situation({ hasAudio: true }));
    expect(plan.source).toBe("rules");
    expect(plan.steps.map((s) => s.kind)).toContain("transcribe_audio");
  });

  it("skips planned steps whose input is missing", () => {
    // No audio this turn, so a planned transcribe_audio is simply not run.
    const { step } = takeFeasible(
      [
        { kind: "transcribe_audio", reason: "planned before we knew" },
        { kind: "ask_learner", reason: "then respond" },
      ],
      situation({ boardRead: true }),
    );
    expect(step?.kind).toBe("ask_learner");
  });

  it("asks for a new plan when the board comes back unsure unexpectedly", () => {
    const unsure = situation({ boardRead: true, boardNeedsConfirmation: true });
    const ignoring = [{ kind: "ask_learner" as const, reason: "carry on regardless" }];
    const handling = [{ kind: "verify_board" as const, reason: "look again" }];

    expect(shouldReplan(unsure, ignoring)).toBe(true);
    expect(shouldReplan(unsure, handling)).toBe(false);
    expect(shouldReplan(situation({ boardRead: true }), ignoring)).toBe(false);
  });
});

// --- the orchestrator executing plans --------------------------------------

describe("orchestrator as planner-driven supervisor", () => {
  it("skips the Vision call when the same board comes back", async () => {
    const session = await newSession();
    const vision = new VisionAgent({ confidenceThreshold: 0.6 });
    const interpret = vi.spyOn(vision, "interpret");
    const orch = new Orchestrator({ learner: new FakeLearner(), vision });

    const first = await orch.runTeachingTurn(session, topic(), {
      image: "same-board-bytes",
      typedText: null,
    });
    expect(first.kind).toBe("learner");
    expect(interpret).toHaveBeenCalledTimes(1);

    // Identical board on the next turn: the planner reuses the reading.
    const second = await orch.runTeachingTurn(session, topic(), {
      image: "same-board-bytes",
      typedText: null,
    });
    expect(second.kind).toBe("learner");
    expect(interpret).toHaveBeenCalledTimes(1); // no second Vision call
    expect(second.plan?.map((s) => s.kind)).toEqual(["reuse_board", "ask_learner"]);
    expect(second.interpretation?.transcribedText).toBe(first.interpretation?.transcribedText);

    // A different board is read normally again.
    await orch.runTeachingTurn(session, topic(), { image: "new-board-bytes", typedText: null });
    expect(interpret).toHaveBeenCalledTimes(2);
  });

  it("never touches ASR on a turn without audio, and uses it when there is", async () => {
    const asr = new FakeAsr();
    const orch = new Orchestrator({
      learner: new FakeLearner(),
      vision: new VisionAgent({ confidenceThreshold: 0.6 }),
      asr,
    });

    const silent = await orch.runTeachingTurn(await newSession(), topic(), {
      image: "board",
      typedText: null,
    });
    expect(asr.calls).toBe(0);
    expect(silent.plan?.map((s) => s.kind)).toEqual(["read_board", "ask_learner"]);

    const spoken = await orch.runTeachingTurn(await newSession(), topic(), {
      image: "board",
      audio: "clip",
      typedText: null,
    });
    expect(asr.calls).toBe(1);
    expect(spoken.speech?.transcript).toBe("spoken explanation");
    expect(spoken.plan?.map((s) => s.kind)).toEqual([
      "read_board",
      "transcribe_audio",
      "ask_learner",
    ]);
  });

  it("verifies an unsure reading, then still finishes the turn without a confirmation UI", async () => {
    const vision = new UnsureVision();
    const orch = new Orchestrator({ learner: new FakeLearner(), vision });

    const result = await orch.runTeachingTurn(await newSession(), topic(), {
      image: "smudged-board",
      typedText: null,
      allowConfirmation: false,
    });

    expect(result.kind).toBe("learner");
    expect(vision.calls).toBe(2); // initial read + one directed re-read
    expect(result.plan?.map((s) => s.kind)).toEqual([
      "read_board",
      "verify_board",
      "ask_learner",
    ]);
    // The student reacts to the best guess rather than to an empty board.
    expect(result.interpretation?.needsConfirmation).toBe(false);
    expect(result.interpretation?.transcribedText).toBeTruthy();
  });

  it("still pauses for confirmation when the caller can act on it", async () => {
    const orch = new Orchestrator({ learner: new FakeLearner(), vision: new UnsureVision() });

    const result = await orch.runTeachingTurn(await newSession(), topic(), {
      image: "smudged-board",
      typedText: null,
    });

    expect(result.kind).toBe("confirmation");
    expect(result.suggestedClarification).toBeTruthy();
    expect(result.plan?.map((s) => s.kind)).toEqual([
      "read_board",
      "verify_board",
      "ask_confirmation",
    ]);
  });

  it("executes the plan a planner hands it", async () => {
    const asr = new FakeAsr();
    const planner = new FixedPlanner({
      steps: [
        { kind: "read_board", reason: "planned" },
        { kind: "transcribe_audio", reason: "planned" },
        { kind: "ask_learner", reason: "planned" },
      ],
      source: "llm",
      rationale: "fixed plan",
    });
    const orch = new Orchestrator({
      learner: new FakeLearner(),
      vision: new VisionAgent({ confidenceThreshold: 0.6 }),
      asr,
      planner,
    });

    const result = await orch.runTeachingTurn(await newSession(), topic(), {
      image: "board",
      audio: "clip",
      typedText: null,
    });

    expect(planner.calls).toBe(1); // one plan, no re-plan needed
    expect(result.plan?.every((s) => s.source === "llm")).toBe(true);
    expect(asr.calls).toBe(1);
  });

  it("recovers when the plan is impossible", async () => {
    // reuse_board on the very first turn: there is nothing to reuse.
    const planner = new FixedPlanner({
      steps: [{ kind: "reuse_board", reason: "nonsense" }],
      source: "llm",
      rationale: "impossible plan",
    });
    const vision = new VisionAgent({ confidenceThreshold: 0.6 });
    const orch = new Orchestrator({ learner: new FakeLearner(), vision, planner });

    const result = await orch.runTeachingTurn(await newSession(), topic(), {
      image: "board",
      typedText: null,
    });

    expect(result.kind).toBe("learner");
    expect(result.plan?.map((s) => s.kind)).toEqual(["read_board", "ask_learner"]);
    expect(result.plan?.every((s) => s.source === "fallback")).toBe(true);
  });

  it("does not spend the budget on a step it cannot actually run", async () => {
    // Audio arrived but no ASR is wired up: the step is attempted once, and the
    // turn still reaches the student instead of retrying until the budget runs out.
    const orch = new Orchestrator({
      learner: new FakeLearner(),
      vision: new VisionAgent({ confidenceThreshold: 0.6 }),
    });

    const result = await orch.runTeachingTurn(await newSession(), topic(), {
      image: "board",
      audio: "clip",
      typedText: null,
    });

    expect(result.kind).toBe("learner");
    expect(result.plan?.map((s) => s.kind)).toEqual([
      "read_board",
      "transcribe_audio",
      "ask_learner",
    ]);
    expect(result.speech).toBeUndefined();
  });
});
