/**
 * The student follows the lesson, not every answer (learner.depth.ts).
 *
 * The messages below are from a real session on the male reproductive system.
 * The reference covered each organ and what it does. The student asked how
 * the urethra keeps urine and sperm apart, then how the valve knows when to
 * close, then how the bladder muscle knows, then how the sympathetic nervous
 * system detects the moment, each question built on the teacher's last answer,
 * and none of it in the reference. When the teacher finally said it was outside
 * the material, the student asked for "everything else" instead.
 */

import { describe, expect, it } from "vitest";

import {
  EARLIER_BOARD_HEADING,
  MAX_FOLLOW_UP_DEPTH,
  teacherSetBoundary,
} from "../src/agents/learner/learner.depth.js";
import { isLearnerTextSafe, normalizeLearnerOutput } from "../src/agents/learner/learner.guard.js";
import { buildLearnerMessages, LEARNER_LLM_OUTPUT_SCHEMA } from "../src/llm/prompts/learner.prompt.js";
import type { LearnerState } from "../src/contracts/learner.js";

// What the teacher typed, verbatim from the session.
const ANSWER_VALVE =
  "Uretra tidak bisa mengeluarkan urine dan sperma bersamaan, terdapat mekanisme katup otomatis yang menutup saluran kencing ketika ejakulasi";
const ANSWER_MUSCLE =
  "terdapat otot di kandung kemih yang menutup rapat agar urine tidak tercampur dengan sperma";
const ANSWER_NERVES =
  "melalui refleks saraf otomatis yang diatur oleh sistem saraf otonom, khususnya sistem saraf simpatik. Anda tidak perlu memikirkannya karena proses ini berjalan secara tidak sadar.";
const BOUNDARY =
  "saya tidak bisa menjelaskannya karena itu diluar lingkup materi yang saya pelajari, di referensi juga tidak ada";
const BOARD = [
  "Testis -> berfungsi menghasilkan sel sperma",
  "Epididimis -> tugasnya mematangkan sel sperma menjadi sperma yang siap untuk dikeluarkan",
  "Vas deferens -> menghubungkan epididimis dengan kelenjar kelamin",
  "Uretra -> saluran kencing dan keluarnya sperma",
].join("\n");

function freshState(depth = 0): LearnerState {
  return {
    sessionId: "ses_depth",
    understoodConcepts: ["uretra"],
    activeMisconceptions: [],
    openGaps: [],
    questionsAsked: [],
    askedConcepts: [],
    followUpDepth: depth,
    updatedAtTurn: 2,
  };
}

function input(teachingText: string, currentState: LearnerState) {
  return { sessionId: "ses_depth", turnIndex: 2, teachingText, currentState };
}

/** What the model proposed: a question, flagged as following up the answer or not. */
function asks(text: string, targetConcept: string, followsUp: boolean) {
  return {
    nextState: freshState(),
    response: { type: "question", text, targetConcept, derivedFrom: "gap", followsUp },
  } as unknown as Parameters<typeof normalizeLearnerOutput>[0];
}

describe("teacherSetBoundary", () => {
  it("recognises the teacher's own words from the session", () => {
    expect(teacherSetBoundary(BOUNDARY)).toBe(true);
  });

  it.each([
    "saya tidak tahu",
    "Aku juga gak ngerti bagian itu",
    "itu bukan bagian dari materi",
    "hal itu tidak dibahas di referensi",
    "I don't know",
    "I can't explain that, it's out of scope",
    "that's not in the reference",
  ])("recognises %j", (text) => {
    expect(teacherSetBoundary(text)).toBe(true);
  });

  it("does not mistake the teacher's explanations for a boundary", () => {
    // Each of these contains "tidak", and the first "tidak bisa". None of them
    // is the teacher giving up; all of them are the lesson.
    for (const text of [ANSWER_VALVE, ANSWER_MUSCLE, ANSWER_NERVES, BOARD]) {
      expect(teacherSetBoundary(text)).toBe(false);
    }
    // Knowing about other people not knowing is teaching too.
    expect(teacherSetBoundary("banyak orang tidak tahu bahwa sperma dibuat di testis")).toBe(false);
  });

  it("ignores a boundary that is only on the old part of the board", () => {
    const text = [
      "Just added to the board this turn:\nKelenjar prostat menghasilkan getah",
      `${EARLIER_BOARD_HEADING}, including earlier material (context, not what was just taught):\nsaya tidak tahu`,
    ].join("\n\n");

    expect(teacherSetBoundary(text)).toBe(false);
  });
});

describe("follow-up depth", () => {
  it("allows one question about how the teacher's answer works", () => {
    const out = normalizeLearnerOutput(
      asks(
        "How exactly does this katup otomatis know when to close during ejaculation?",
        "katup otomatis",
        true,
      ),
      input(ANSWER_VALVE, freshState(0)),
    );

    expect(out.response.type).toBe("question");
    expect(out.nextState.followUpDepth).toBe(1);
  });

  it("turns the second one in a row back to the lesson", () => {
    const out = normalizeLearnerOutput(
      asks(
        "How exactly does that bladder muscle know when to close automatically during ejaculation?",
        "bladder muscle",
        true,
      ),
      input(ANSWER_MUSCLE, freshState(MAX_FOLLOW_UP_DEPTH)),
    );

    expect(out.response.type).toBe("acknowledgment");
    expect(out.response.text.toLowerCase()).toMatch(/lesson|material/);
    expect(out.response.text).not.toMatch(/muscle|nervous/i);
    expect(isLearnerTextSafe(out.response.text)).toBe(true);
    // The chain is over, so the next follow-up starts counting from zero.
    expect(out.nextState.followUpDepth).toBe(0);
  });

  it("stops the chain from the session after the first step", () => {
    // Replays the real session: the three follow-ups the student asked in a row.
    let state = freshState(0);
    const replies = [
      [ANSWER_VALVE, "How does the katup otomatis know when to close?", "katup otomatis"],
      [ANSWER_MUSCLE, "How does that bladder muscle know when to close?", "bladder muscle"],
      [ANSWER_NERVES, "How does the sympathetic nervous system detect the moment?", "sympathetic nervous system"],
    ].map(([answer, question, concept]) => {
      const out = normalizeLearnerOutput(asks(question, concept, true), input(answer, state));
      state = out.nextState;
      return out.response.type;
    });

    // One follow-up is curiosity. The second is where it used to become a drill.
    expect(replies[0]).toBe("question");
    expect(replies[1]).toBe("acknowledgment");
  });

  it("never holds back a question about the lesson itself", () => {
    const out = normalizeLearnerOutput(
      asks("So where does the sperma go after the epididimis?", "epididimis", false),
      input(BOARD, freshState(MAX_FOLLOW_UP_DEPTH)),
    );

    expect(out.response.type).toBe("question");
    expect(out.nextState.followUpDepth).toBe(0);
  });
});

describe("when the teacher sets a boundary", () => {
  it("lets the question go instead of asking for everything else", () => {
    // What the student actually said after being told it was out of scope.
    const out = normalizeLearnerOutput(
      asks(
        "Then please, show me everything else we can study about the system reproduksi pria, I want to master every single detail you have!",
        "sistem reproduksi pria",
        false,
      ),
      input(BOUNDARY, freshState(1)),
    );

    expect(out.response.type).toBe("acknowledgment");
    expect(out.response.text).not.toMatch(/everything|every single/i);
    expect(out.response.text.toLowerCase()).toMatch(/lesson|material/);
    expect(isLearnerTextSafe(out.response.text)).toBe(true);
    expect(out.nextState.followUpDepth).toBe(0);
  });

  it("keeps the student's own acknowledgment when it already let go", () => {
    const own = "Oh, okay, no problem! Let's continue with what you were teaching then.";
    const out = normalizeLearnerOutput(
      {
        nextState: freshState(),
        response: { type: "acknowledgment", text: own, targetConcept: "", derivedFrom: "new_info", followsUp: false },
      } as unknown as Parameters<typeof normalizeLearnerOutput>[0],
      input(BOUNDARY, freshState(1)),
    );

    expect(out.response.text).toBe(own);
  });
});

describe("learner prompt", () => {
  it("asks the model whether its question follows up the teacher's answer", () => {
    const response = (LEARNER_LLM_OUTPUT_SCHEMA.properties as any).response;
    expect(response.properties.followsUp).toEqual({ type: "boolean" });
    expect(response.required).toContain("followsUp");
  });

  it("tells the student when it has already spent its follow-up", () => {
    const spent = buildLearnerMessages(input(ANSWER_MUSCLE, freshState(MAX_FOLLOW_UP_DEPTH)));
    const fresh = buildLearnerMessages(input(ANSWER_VALVE, freshState(0)));

    const user = (messages: typeof spent) => messages.find((m) => m.role === "user")!.content;
    expect(user(spent)).toMatch(/already followed up/);
    expect(user(fresh)).not.toMatch(/already followed up/);
  });
});
