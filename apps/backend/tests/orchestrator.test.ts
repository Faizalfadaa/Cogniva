/** Orchestrator tests (Architecture Document §3.3, §5.1) — one full teaching turn. */

import { describe, expect, it, vi } from "vitest";

import { LearnerAgent, VisionAgent } from "../src/agents/index.js";
import { utcNowIso } from "../src/contracts/common.js";
import type { LearnerResponse, LearnerState } from "../src/contracts/learner.js";
import type { Session } from "../src/contracts/session.js";
import { Orchestrator, type Asr, type Learner, type Vision } from "../src/orchestrator/index.js";
import * as config from "../src/config/index.js";
import type { VisionInterpretation } from "../src/contracts/board.js";
import { newId, sessions } from "../src/modules/storage/sessionStore.js";
import { topics } from "../src/modules/topic/repository.js";

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
    const newState: LearnerState = {
      sessionId: state.sessionId,
      understoodConcepts: [],
      activeMisconceptions: [...state.activeMisconceptions],
      openGaps: [],
      questionsAsked: [response.text],
      updatedAtTurn: turnIndex,
    };
    return [response, newState];
  }
}

function newSession(): Session {
  const session: Session = {
    sessionId: newId("ses"),
    topicId: "topic_photosynthesis",
    status: "TEACHING",
    createdAt: utcNowIso(),
    turnCount: 0,
    tokensUsed: 0,
    evaluationIds: [],
  };
  return sessions.saveSession(session);
}

function orchestrator(): Orchestrator {
  return new Orchestrator({
    learner: new FakeLearner(),
    vision: new VisionAgent({ confidenceThreshold: 0.6 }),
  });
}

describe("orchestrator", () => {
  it("runs a full turn, persists it, and advances the counter", async () => {
    const session = newSession();
    const topic = topics.get("topic_photosynthesis")!;
    const orch = orchestrator();

    const result = await orch.runTeachingTurn(session, topic, {
      image: null,
      typedText: "Plants turn light into sugar.",
    });

    expect(result.kind).toBe("learner");
    expect(result.response).toBeDefined();
    expect(result.interpretation?.transcribedText).toBe("Plants turn light into sugar.");

    // Turn was persisted and the counter advanced.
    expect(session.turnCount).toBe(1);
    const turns = sessions.listTurns(session.sessionId);
    expect(turns).toHaveLength(1);
    expect(turns[0].learnerResponseId).toBe(result.response!.responseId);
    expect(sessions.getResponse(result.response!.responseId)).toBeDefined();
    expect(sessions.getLearnerState(session.sessionId)).toBeDefined();
  });

  it("proceeds to the learner on an image-only turn (M2: Vision can read it now)", async () => {
    const session = newSession();
    const topic = topics.get("topic_photosynthesis")!;
    const orch = orchestrator();

    // No typed text, only an image -> real Vision (mock mode, no API key in
    // tests) reads it successfully, so the turn proceeds to the Learner.
    const result = await orch.runTeachingTurn(session, topic, {
      image: "base64data",
      typedText: null,
    });

    expect(result.kind).toBe("learner");
    expect(session.turnCount).toBe(1);
  });

  it("lets the Learner use the reread_board tool mid-turn (agentic loop)", async () => {
    const session = newSession();
    const topic = topics.get("topic_photosynthesis")!;
    const vision = new VisionAgent({ confidenceThreshold: 0.6 });
    const interpret = vi.spyOn(vision, "interpret");
    // Real Learner in mock mode investigates an unclear term before asking.
    const orch = new Orchestrator({ learner: new LearnerAgent({ forceMock: true }), vision });

    const result = await orch.runTeachingTurn(session, topic, {
      image: "base64data",
      typedText: null,
    });

    expect(result.kind).toBe("learner");
    expect(result.response?.text.trim()).toBeTruthy();
    // The re-read now reuses this turn's interpretation instead of making a
    // second multimodal call, so Vision runs exactly once however many times
    // the student consults the board (§7.3).
    expect(interpret).toHaveBeenCalledTimes(1);
  });

  it("requests confirmation when there is neither image nor typed text", async () => {
    const session = newSession();
    const topic = topics.get("topic_photosynthesis")!;
    const orch = orchestrator();

    const result = await orch.runTeachingTurn(session, topic, {
      image: null,
      typedText: null,
    });

    expect(result.kind).toBe("confirmation");
    expect(result.snapshotId).toBeTruthy();
    expect(result.suggestedClarification).toBeTruthy();
    // The pause came from the board channel, not the voice one.
    expect(result.source).toBe("board");
    // No learner turn ran, so the counter did not advance.
    expect(session.turnCount).toBe(0);
    expect(sessions.listTurns(session.sessionId)).toEqual([]);
  });

  it("also pauses when only the voice channel is uncertain", async () => {
    const session = newSession();
    const topic = topics.get("topic_photosynthesis")!;
    // The board is fine (typed text reads at full confidence), so any pause
    // here has to come from ASR — proving the voice channel can stop a turn
    // on its own, not just ride along with a bad board reading.
    const asr: Asr = {
      transcribe: async () => ({
        segmentId: newId("seg"),
        sessionId: session.sessionId,
        turnIndex: session.turnCount,
        transcript: "...suaranya kurang jelas...",
        confidence: 0.2,
        language: "id-ID",
        capturedAt: utcNowIso(),
        needsConfirmation: true,
        suggestedClarification: "Bisa diulang lebih jelas?",
      }),
    };
    const orch = new Orchestrator({
      learner: new FakeLearner(),
      vision: new VisionAgent({ confidenceThreshold: 0.6 }),
      asr,
    });

    const result = await orch.runTeachingTurn(session, topic, {
      image: null,
      typedText: "Fotosintesis mengubah cahaya jadi energi.",
      audio: "ZmFrZQ==",
    });

    expect(result.kind).toBe("confirmation");
    expect(result.source).toBe("voice");
    expect(result.suggestedClarification).toBe("Bisa diulang lebih jelas?");
    // The Learner never ran, so the counter did not advance.
    expect(session.turnCount).toBe(0);
    expect(sessions.listTurns(session.sessionId)).toEqual([]);
  });
});

/**
 * Token budget (§7.3). A fake Vision reports usage directly, so the meter is
 * exercised without any LLM call — the mock agents spend nothing.
 */
describe("orchestrator token budget", () => {
  /** Vision that reads the board fine and reports a fixed token cost. */
  function meteredVision(inputTokens: number, outputTokens: number): Vision {
    return {
      interpret: async (snapshot, _typedText, _topic, onUsage) => {
        onUsage?.({ inputTokens, outputTokens });
        const interpretation: VisionInterpretation = {
          snapshotId: snapshot.snapshotId,
          transcribedText: "Fotosintesis mengubah cahaya jadi energi kimia.",
          elements: [],
          confidence: 1,
          needsConfirmation: false,
        };
        return interpretation;
      },
    };
  }

  it("adds each agent's reported tokens to the session total", async () => {
    const session = newSession();
    const topic = topics.get("topic_photosynthesis")!;
    const orch = new Orchestrator({
      learner: new FakeLearner(),
      vision: meteredVision(100, 40),
    });

    await orch.runTeachingTurn(session, topic, { image: "base64data", typedText: null });

    expect(sessions.getSession(session.sessionId)?.tokensUsed).toBe(140);
  });

  it("still records tokens when the turn pauses for confirmation", async () => {
    const session = newSession();
    const topic = topics.get("topic_photosynthesis")!;
    // Vision spends tokens and then asks for confirmation, so the turn exits
    // early. Those tokens were spent regardless and must still be counted,
    // otherwise a session that keeps pausing never approaches its cap.
    const vision: Vision = {
      interpret: async (snapshot, _typedText, _topic, onUsage) => {
        onUsage?.({ inputTokens: 70, outputTokens: 30 });
        return {
          snapshotId: snapshot.snapshotId,
          transcribedText: "",
          elements: [],
          confidence: 0.1,
          needsConfirmation: true,
          suggestedClarification: "Papannya kurang terbaca, bisa ditulis ulang?",
        };
      },
    };
    const orch = new Orchestrator({ learner: new FakeLearner(), vision });

    const result = await orch.runTeachingTurn(session, topic, {
      image: "base64data",
      typedText: null,
    });

    expect(result.kind).toBe("confirmation");
    expect(sessions.getSession(session.sessionId)?.tokensUsed).toBe(100);
  });

  it("refuses the turn once the session is at its budget, spending nothing", async () => {
    const session = newSession();
    session.tokensUsed = config.SESSION_TOKEN_BUDGET;
    sessions.saveSession(session);
    const topic = topics.get("topic_photosynthesis")!;

    const learner = new FakeLearner();
    const respond = vi.spyOn(learner, "respond");
    const vision = meteredVision(100, 40);
    const interpret = vi.spyOn(vision, "interpret");
    const orch = new Orchestrator({ learner, vision });

    const result = await orch.runTeachingTurn(session, topic, {
      image: "base64data",
      typedText: null,
    });

    expect(result.kind).toBe("budget_exceeded");
    // The gate runs before any agent, so the refusal itself costs nothing.
    expect(interpret).not.toHaveBeenCalled();
    expect(respond).not.toHaveBeenCalled();
    expect(session.turnCount).toBe(0);
    expect(sessions.getSession(session.sessionId)?.tokensUsed).toBe(
      config.SESSION_TOKEN_BUDGET,
    );
  });

  it("runs the turn anyway under DEMO_MODE, and keeps counting the usage", async () => {
    // DEMO_MODE is read from the environment at import time, so the modules are
    // reloaded with the flag set rather than mutated in place.
    const previous = process.env.COGNIVA_DEMO_MODE;
    process.env.COGNIVA_DEMO_MODE = "true";
    vi.resetModules();
    try {
      const demoConfig = await import("../src/config/index.js");
      const { Orchestrator: DemoOrchestrator } = await import("../src/orchestrator/index.js");
      const demoStore = await import("../src/modules/storage/sessionStore.js");
      const { topics: demoTopics } = await import("../src/modules/topic/repository.js");

      expect(demoConfig.DEMO_MODE).toBe(true);

      const overBudget = demoConfig.SESSION_TOKEN_BUDGET + 1000;
      const session: Session = {
        sessionId: demoStore.newId("ses"),
        topicId: "topic_photosynthesis",
        status: "TEACHING",
        createdAt: utcNowIso(),
        turnCount: 0,
        tokensUsed: overBudget,
        evaluationIds: [],
      };
      demoStore.sessions.saveSession(session);

      const orch = new DemoOrchestrator({
        learner: new FakeLearner(),
        vision: meteredVision(100, 40),
      });

      const result = await orch.runTeachingTurn(
        session,
        demoTopics.get("topic_photosynthesis")!,
        { image: "base64data", typedText: null },
      );

      // Enforcement is skipped...
      expect(result.kind).toBe("learner");
      // ...but the accounting is not, so the demo can still be asked afterwards
      // what it actually cost.
      expect(demoStore.sessions.getSession(session.sessionId)?.tokensUsed).toBe(
        overBudget + 140,
      );
    } finally {
      if (previous === undefined) delete process.env.COGNIVA_DEMO_MODE;
      else process.env.COGNIVA_DEMO_MODE = previous;
      vi.resetModules();
    }
  });
});
