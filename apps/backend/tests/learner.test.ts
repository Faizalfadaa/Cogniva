/**
 * Learner agent tests (Architecture Document §3.6, §6.7, §6.8).
 *
 * The learning logic comes from the team's module (runLearnerTurn + guard +
 * mock); this suite exercises it through the orchestrator's adapter and the
 * guard directly, in deterministic mock mode (no network, no API key).
 */

import { describe, expect, it, vi } from "vitest";

import { LearnerAgent, seedLearnerState, seedLearnerStateFromEvaluation } from "../src/agents/index.js";
import type { EvaluationResult } from "../src/contracts/evaluation.js";
import { runLearnerTurn } from "../src/agents/learner/learner.agent.js";
import {
  createFallbackOutput,
  isLearnerTextSafe,
  normalizeLearnerOutput,
} from "../src/agents/learner/learner.guard.js";
import {
  conceptKey,
  conceptsAtLimit,
  MAX_SAME_CONCEPT_QUESTIONS,
} from "../src/agents/learner/learner.repeat.js";
import {
  EXTEND_EVERY_TURNS,
  harderCase,
  shouldExtendThisTurn,
} from "../src/agents/learner/learner.extend.js";
import type { VisionInterpretation } from "../src/contracts/board.js";
import type { LearnerState } from "../src/contracts/learner.js";

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

function freshState(sessionId = "ses_1"): LearnerState {
  return {
    sessionId,
    understoodConcepts: [],
    activeMisconceptions: [],
    openGaps: [],
    questionsAsked: [],
    updatedAtTurn: 0,
  };
}

describe("seedLearnerState", () => {
  it("seeds misconceptions from the topic only", () => {
    const state = seedLearnerState(
      "ses_1",
      ["O2 berasal dari CO2", "reaksi gelap perlu kegelapan"],
      { topicTitle: "Fotosintesis" },
    );
    expect(state.understoodConcepts).toEqual([]);
    expect(state.activeMisconceptions).toHaveLength(2);
    expect(state.activeMisconceptions[0]).toEqual({
      concept: "Fotosintesis",
      belief: "O2 berasal dari CO2",
    });
    expect(state.updatedAtTurn).toBe(0);
  });

  it("caps the seeded misconceptions at 3", () => {
    const state = seedLearnerState("ses_1", ["a", "b", "c", "d", "e"], {
      topicTitle: "T",
    });
    expect(state.activeMisconceptions).toHaveLength(3);
  });
});

describe("seedLearnerStateFromEvaluation (adaptive resume)", () => {
  function evalResult(findings: EvaluationResult["findings"], improvements: string[] = []): EvaluationResult {
    return {
      evaluationId: "ev_1",
      sessionId: "ses_1",
      score: 60,
      depthScore: 40,
      findings,
      summary: "ringkasan",
      strengths: [],
      improvements,
      generatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  it("re-aims the Learner at the user's weak spots from the last evaluation", () => {
    const seeded = seedLearnerStateFromEvaluation(
      "ses_1",
      evalResult(
        [
          { category: "CORRECT", concept: "Definisi dasar", detail: "tersampaikan", evidenceTurnIndex: 0 },
          { category: "WRONG", concept: "Arah reaksi", detail: "membalik sebab dan akibat", evidenceTurnIndex: 1 },
          { category: "MISSED", concept: "Peran cahaya", detail: "belum dibahas", evidenceTurnIndex: null },
        ],
        ["Bahas peran enzim"],
      ),
    );

    // CORRECT -> understood (won't be re-probed)
    expect(seeded.understoodConcepts).toContain("Definisi dasar");
    // WRONG -> active misconception to correct by re-teaching
    expect(seeded.activeMisconceptions).toEqual([
      { concept: "Arah reaksi", belief: "membalik sebab dan akibat" },
    ]);
    // MISSED/CONFUSING + improvements -> open gaps to ask about
    expect(seeded.openGaps).toEqual(expect.arrayContaining(["Peran cahaya", "Bahas peran enzim"]));
  });

  it("keeps the carried-over memory when the evaluation has no findings", () => {
    const previous = {
      sessionId: "ses_1",
      understoodConcepts: ["X"],
      activeMisconceptions: [{ concept: "Y", belief: "z" }],
      openGaps: ["g"],
      questionsAsked: ["q"],
      updatedAtTurn: 3,
    };
    const seeded = seedLearnerStateFromEvaluation("ses_1", evalResult([]), previous);
    expect(seeded).toEqual(previous);
  });
});

describe("LearnerAgent adapter (mock mode)", () => {
  it("returns a student-role response and advances the state", async () => {
    const agent = new LearnerAgent({ forceMock: true });
    const [response, next] = await agent.respond({
      topicTitle: "Variabel",
      topicDescription: "",
      interpretation: interp("Variabel adalah tempat menyimpan nilai dalam program."),
      speech: null,
      state: freshState(),
      turnIndex: 1,
    });

    expect(STUDENT_TYPES).toContain(response.type);
    expect(DERIVED).toContain(response.derivedFrom);
    expect(response.text.trim()).toBeTruthy();
    expect(response.turnIndex).toBe(1);
    expect(next.updatedAtTurn).toBe(1);
    // Adapter normalizes the optional targetConcept to `string | null`.
    expect(response.targetConcept === null || typeof response.targetConcept === "string").toBe(true);
  });
});

describe("runLearnerTurn (mock)", () => {
  it("records the question it asks about an unclear term", async () => {
    const out = await runLearnerTurn(
      {
        sessionId: "ses_1",
        turnIndex: 2,
        teachingText: 'Yang penting di sini adalah istilah "fotosintesis".',
        currentState: freshState(),
      },
      { useMock: true },
    );

    expect(out.nextState.updatedAtTurn).toBe(2);
    expect(out.response.type).toBe("question");
    expect(out.nextState.questionsAsked).toContain(out.response.text);
  });
});

describe("runLearnerTurn agentic loop (mock)", () => {
  it("uses the reread_board tool to investigate, then responds", async () => {
    const rereadBoard = vi.fn(async (focus: string) => `(detail) ${focus}`);

    const out = await runLearnerTurn(
      {
        sessionId: "ses_1",
        turnIndex: 1,
        teachingText: 'Yang penting di sini adalah istilah "fotosintesis".',
        currentState: freshState(),
      },
      { useMock: true, tools: { rereadBoard } },
    );

    // The student investigated the unclear term before asking (agentic tool use).
    expect(rereadBoard).toHaveBeenCalledTimes(1);
    expect(rereadBoard).toHaveBeenCalledWith("fotosintesis");
    // ...and still finalized with a valid student response.
    expect(STUDENT_TYPES).toContain(out.response.type);
    expect(out.response.text.trim()).toBeTruthy();
  });

  it("collapses to a single response when no tools are injected", async () => {
    const rereadBoard = vi.fn(async () => "(detail)");
    await runLearnerTurn(
      {
        sessionId: "ses_1",
        turnIndex: 1,
        teachingText: 'Istilah "klorofil" itu kuncinya.',
        currentState: freshState(),
      },
      { useMock: true }, // no tools
    );
    expect(rereadBoard).not.toHaveBeenCalled();
  });

  it("is bounded — never loops forever even if a tool stays available", async () => {
    const rereadBoard = vi.fn(async () => "(detail)");
    const out = await runLearnerTurn(
      {
        sessionId: "ses_1",
        turnIndex: 2,
        teachingText: 'Istilah "kloroplas" itu kuncinya.',
        currentState: freshState(),
      },
      { useMock: true, tools: { rereadBoard } },
    );
    // Dedup + step cap keep it to one investigation, then a response.
    expect(rereadBoard.mock.calls.length).toBeLessThanOrEqual(2);
    expect(STUDENT_TYPES).toContain(out.response.type);
  });
});

describe("learner guard", () => {
  it("flags teacher-like or overly long text as unsafe", () => {
    expect(isLearnerTextSafe("I'm still confused, can you repeat that?")).toBe(true);
    expect(isLearnerTextSafe("The correct answer is that photosynthesis produces oxygen.")).toBe(false);
    expect(isLearnerTextSafe(Array(60).fill("word").join(" "))).toBe(false);
  });

  it("coerces an invalid LLM response into a safe student shape", () => {
    const raw = {
      nextState: freshState(),
      response: { type: "lecture", text: "Hmm, aku belum paham.", derivedFrom: "whatever" },
    } as unknown as Parameters<typeof normalizeLearnerOutput>[0];

    const out = normalizeLearnerOutput(raw, {
      sessionId: "ses_1",
      turnIndex: 1,
      teachingText: "x",
      currentState: freshState(),
    });

    expect(STUDENT_TYPES).toContain(out.response.type);
    expect(DERIVED).toContain(out.response.derivedFrom);
    expect(out.nextState.updatedAtTurn).toBe(1);
  });

  it("produces an in-character fallback when the LLM fails", () => {
    const out = createFallbackOutput({
      sessionId: "ses_1",
      turnIndex: 3,
      teachingText: "",
      currentState: freshState(),
    });
    expect(["question", "confusion"]).toContain(out.response.type);
    expect(out.response.text.trim()).toBeTruthy();
    expect(out.nextState.updatedAtTurn).toBe(3);
  });
});

describe("repeat limit (same core question at most twice)", () => {
  const input = (turnIndex: number, currentState: LearnerState) => ({
    sessionId: "ses_1",
    turnIndex,
    teachingText: "Fotosintesis mengubah cahaya menjadi energi kimia.",
    currentState,
  });

  const asks = (concept: string, text: string) =>
    ({
      nextState: freshState(),
      response: { type: "question", text, targetConcept: concept, derivedFrom: "gap" },
    }) as unknown as Parameters<typeof normalizeLearnerOutput>[0];

  it("normalizes wording so a reworded repeat counts as the same question", () => {
    expect(conceptKey("the light reaction")).toBe(conceptKey("How does the light reaction work?"));
    expect(conceptKey("peran cahaya")).not.toBe(conceptKey("peran enzim"));
  });

  it("counts each question against its concept", () => {
    let state = freshState();

    const first = normalizeLearnerOutput(
      asks("peran cahaya", "Kenapa cahaya penting di situ?"),
      input(1, state),
    );
    expect(first.response.type).toBe("question");
    state = first.nextState;
    expect(state.askedConcepts).toEqual([
      { key: "cahaya peran", label: "peran cahaya", count: 1, kind: "probe" },
    ]);

    // Reworded, same core question -> the same tally, not a new one.
    const second = normalizeLearnerOutput(
      asks("cahaya", "Cahaya itu perannya bagaimana?"),
      input(2, state),
    );
    expect(second.response.type).toBe("question");
    state = second.nextState;
    expect(state.askedConcepts).toHaveLength(1);
    expect(state.askedConcepts?.[0].count).toBe(MAX_SAME_CONCEPT_QUESTIONS);
    expect(conceptsAtLimit(state)).toContain("peran cahaya");
  });

  it("accepts the explanation and asks to move on instead of asking a third time", () => {
    const state: LearnerState = {
      ...freshState(),
      askedConcepts: [
        { key: "cahaya peran", label: "peran cahaya", count: MAX_SAME_CONCEPT_QUESTIONS },
      ],
    };

    const third = normalizeLearnerOutput(
      asks("peran cahaya", "Aku masih belum paham peran cahaya, jelaskan lagi?"),
      input(3, state),
    );

    expect(third.response.type).toBe("acknowledgment");
    expect(third.response.text.toLowerCase()).toMatch(/next|comes next|move on/);
    expect(isLearnerTextSafe(third.response.text)).toBe(true);
    // The tally does not grow, and the gap is still on the record for the Evaluator.
    expect(third.nextState.askedConcepts?.[0].count).toBe(MAX_SAME_CONCEPT_QUESTIONS);
  });

  it("leaves a question about a different concept alone", () => {
    const state: LearnerState = {
      ...freshState(),
      askedConcepts: [
        { key: "cahaya peran", label: "peran cahaya", count: MAX_SAME_CONCEPT_QUESTIONS },
      ],
    };

    const out = normalizeLearnerOutput(
      asks("peran enzim", "Enzimnya kerjanya bagaimana?"),
      input(4, state),
    );

    expect(out.response.type).toBe("question");
    expect(out.nextState.askedConcepts).toHaveLength(2);
  });

  it("does not count a paraphrase or an acknowledgment as pressing the same point", () => {
    const raw = {
      nextState: freshState(),
      response: {
        type: "paraphrase",
        text: "Jadi cahaya itu yang memulai reaksinya, benar?",
        targetConcept: "peran cahaya",
        derivedFrom: "new_info",
      },
    } as unknown as Parameters<typeof normalizeLearnerOutput>[0];

    const out = normalizeLearnerOutput(raw, input(1, freshState()));
    expect(out.response.type).toBe("paraphrase");
    expect(out.nextState.askedConcepts).toEqual([]);
  });

  it("holds the mock learner to the same limit across turns", async () => {
    let state: LearnerState = freshState();
    const teachingText = 'Yang penting di sini adalah istilah "fotosintesis".';
    const types: string[] = [];

    for (let turn = 1; turn <= 3; turn++) {
      const out = await runLearnerTurn(
        { sessionId: "ses_1", turnIndex: turn, teachingText, currentState: state },
        { useMock: true },
      );
      types.push(out.response.type);
      state = out.nextState;
    }

    // Two questions about "fotosintesis", then it moves on.
    expect(types.slice(0, 2)).toEqual(["question", "question"]);
    expect(types[2]).toBe("acknowledgment");
  });

  it("applies the limit to the LLM-failure fallback too", () => {
    const state: LearnerState = {
      ...freshState(),
      askedConcepts: [
        { key: "explanation latest", label: "the latest explanation", count: MAX_SAME_CONCEPT_QUESTIONS },
      ],
    };

    const out = createFallbackOutput({
      sessionId: "ses_1",
      turnIndex: 5,
      teachingText: "x",
      currentState: state,
    });

    expect(out.response.type).toBe("acknowledgment");
  });
});

describe("extending questions (pushing the idea further)", () => {
  it("builds a harder case out of the teacher's own example", () => {
    // The case that motivated this: taught F0, ask about FFFFF.
    expect(harderCase("F0 dalam heksadesimal sama dengan 240")).toEqual({
      from: "F0",
      to: "FFFFF",
    });
    // A plain number grows instead.
    expect(harderCase("misalnya 25 barang")).toEqual({ from: "25", to: "25000" });
    // Nothing to build on -> no invented case.
    expect(harderCase("fotosintesis butuh cahaya")).toBeNull();
  });

  it("stays occasional, and waits until something has landed", () => {
    const state = (understood: string[]): LearnerState => ({
      ...freshState(),
      understoodConcepts: understood,
    });
    const at = (turnIndex: number, understood: string[]) =>
      shouldExtendThisTurn({
        sessionId: "ses_1",
        turnIndex,
        teachingText: "F0 = 240",
        currentState: state(understood),
      });

    // Nothing understood yet -> plain beginner questions only.
    expect(at(EXTEND_EVERY_TURNS, [])).toBe(false);
    // Not on the opening turn, even with the cadence satisfied.
    expect(at(0, ["heksadesimal"])).toBe(false);
    // Then one turn in every EXTEND_EVERY_TURNS, not all of them.
    expect(at(EXTEND_EVERY_TURNS, ["heksadesimal"])).toBe(true);
    expect(at(EXTEND_EVERY_TURNS + 1, ["heksadesimal"])).toBe(false);
  });

  it("asks about the bigger case on such a turn (mock)", async () => {
    const out = await runLearnerTurn(
      {
        sessionId: "ses_1",
        turnIndex: EXTEND_EVERY_TURNS,
        teachingText: "Mengubah F0 heksadesimal ke desimal hasilnya 240.",
        currentState: { ...freshState(), understoodConcepts: ["heksadesimal ke desimal"] },
      },
      { useMock: true },
    );

    expect(out.response.type).toBe("question");
    expect(out.response.text).toContain("FFFFF");
    expect(out.response.derivedFrom).toBe("new_info");
    expect(isLearnerTextSafe(out.response.text)).toBe(true);
  });

  it("counts extensions apart, so a new case survives the repeat limit", () => {
    // The concept is already spent on plain questions...
    const state: LearnerState = {
      ...freshState(),
      askedConcepts: [
        {
          key: "desimal heksadesimal ke",
          label: "heksadesimal ke desimal",
          count: MAX_SAME_CONCEPT_QUESTIONS,
          kind: "probe",
        },
      ],
    };

    const extending = {
      nextState: freshState(),
      action: { kind: "respond", strategy: "extend_example" },
      response: {
        type: "question",
        text: "Kalau F0 begitu, FFFFF bagaimana?",
        targetConcept: "heksadesimal ke desimal",
        derivedFrom: "new_info",
      },
    } as unknown as Parameters<typeof normalizeLearnerOutput>[0];

    const out = normalizeLearnerOutput(extending, {
      sessionId: "ses_1",
      turnIndex: EXTEND_EVERY_TURNS,
      teachingText: "F0 = 240",
      currentState: state,
    });

    // ...but a question about a NEW case still gets asked, under its own budget.
    expect(out.response.type).toBe("question");
    expect(out.response.text).toContain("FFFFF");
    expect(out.nextState.askedConcepts).toHaveLength(2);
    expect(out.nextState.askedConcepts?.find((e) => e.kind === "extend")?.count).toBe(1);
    // The plain tally is untouched, so ordinary repeats are still capped.
    expect(conceptsAtLimit(out.nextState)).toContain("heksadesimal ke desimal");
  });

  it("caps extensions too — the student can't turn one concept into a quiz", () => {
    const state: LearnerState = {
      ...freshState(),
      askedConcepts: [
        {
          key: "desimal heksadesimal ke",
          label: "heksadesimal ke desimal",
          count: MAX_SAME_CONCEPT_QUESTIONS,
          kind: "extend",
        },
      ],
    };

    const extending = {
      nextState: freshState(),
      action: { kind: "respond", strategy: "extend_example" },
      response: {
        type: "question",
        text: "Kalau FFFFF begitu, FFFFFFFF bagaimana?",
        targetConcept: "heksadesimal ke desimal",
        derivedFrom: "new_info",
      },
    } as unknown as Parameters<typeof normalizeLearnerOutput>[0];

    const out = normalizeLearnerOutput(extending, {
      sessionId: "ses_1",
      turnIndex: 6,
      teachingText: "F0 = 240",
      currentState: state,
    });

    expect(out.response.type).toBe("acknowledgment");
  });
});
