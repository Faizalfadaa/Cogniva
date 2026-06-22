/** Orchestrator tests (Architecture Document §3.3, §5.1) — one full teaching turn. */

import { describe, expect, it } from "vitest";

import { VisionAgent } from "../src/agents/index.js";
import { utcNowIso } from "../src/contracts/common.js";
import type { LearnerResponse, LearnerState } from "../src/contracts/learner.js";
import type { Session } from "../src/contracts/session.js";
import { Orchestrator, type Learner } from "../src/orchestrator/index.js";
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

  it("requests confirmation for an image-only turn", async () => {
    const session = newSession();
    const topic = topics.get("topic_photosynthesis")!;
    const orch = orchestrator();

    // No typed text + only an image -> Vision (M1 stub) can't read it yet.
    const result = await orch.runTeachingTurn(session, topic, {
      image: "base64data",
      typedText: null,
    });

    expect(result.kind).toBe("confirmation");
    expect(result.snapshotId).toBeTruthy();
    expect(result.suggestedClarification).toBeTruthy();
    // No learner turn ran, so the counter did not advance.
    expect(session.turnCount).toBe(0);
    expect(sessions.listTurns(session.sessionId)).toEqual([]);
  });
});
