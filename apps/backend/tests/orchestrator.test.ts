/** Orchestrator tests (Architecture Document §3.3, §5.1) — one full teaching turn. */

import { describe, expect, it, vi } from "vitest";

import { LearnerAgent, VisionAgent } from "../src/agents/index.js";
import { utcNowIso } from "../src/contracts/common.js";
import type { LearnerResponse, LearnerState } from "../src/contracts/learner.js";
import type { Session } from "../src/contracts/session.js";
import { Orchestrator, type Asr, type Learner } from "../src/orchestrator/index.js";
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
    // Vision ran twice: the initial board read + one directed re-read the
    // Learner requested through its injected tool.
    expect(interpret.mock.calls.length).toBeGreaterThanOrEqual(2);
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
