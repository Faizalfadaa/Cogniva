/**
 * A real session, replayed: a story lesson on the first arc of Naruto, taught
 * on the board and answered in the chat panel, in an Indonesian workspace.
 *
 * Four things went wrong in it, and each is pinned here with the teacher's own
 * words:
 *
 *  - Every chat reply after the third board turn came in the same voice
 *    ("I-it's not like I care…"), and each was a new "what if" question: a
 *    group of rogue ninja, then the Hokage himself, then a whole clan. The
 *    style and the "push it further" nudge were paced by the board's turn
 *    index, which a chat never moves (learner.extend.ts).
 *  - Those what-ifs were three questions in a row leading away from the story,
 *    and nothing counted them, because each had a new concept label and the
 *    depth limit only knew about follow-ups (learner.depth.ts).
 *  - "It was a rumor, I don't know exactly who spread it" answered the
 *    question, and the student replied "that's beyond our material" as if it
 *    had been refused (learner.depth.ts readBoundary).
 *  - The teacher wrote "segel rahasia"; the student asked about the "forbidden
 *    scroll", a name it knew from the real story (learner.terms.ts).
 */

import { describe, expect, it } from "vitest";

import {
  backToLessonText,
  boundaryText,
  MAX_FOLLOW_UP_DEPTH,
  partialBoundaryText,
  readBoundary,
} from "../src/agents/learner/learner.depth.js";
import { replyIndex, shouldExtendThisTurn } from "../src/agents/learner/learner.extend.js";
import { createFallbackOutput, isLearnerTextSafe, normalizeLearnerOutput } from "../src/agents/learner/learner.guard.js";
import { moveOnText } from "../src/agents/learner/learner.repeat.js";
import { MAX_TEACHER_TERMS, namesIn, nextTeacherTerms } from "../src/agents/learner/learner.terms.js";
import { composeTeachingText } from "../src/agents/learner/index.js";
import { buildLearnerMessages } from "../src/llm/prompts/learner.prompt.js";
import type { LearnerState } from "../src/contracts/learner.js";

// --- The session ------------------------------------------------------------

const BOARD_1 =
  "Naruto Uzumaki adalah seorang anak dari Minato Namikaze dan Kushina Uzumaki. Ia Lahir ketika terjadi insiden Kurama di desa Konoha. Karena insiden tersebut, kedua orang tuanya meninggal dan meninggalkan segel ekor sembilan di tubuh naruto.";
const BOARD_3_NEW = [
  "Ketika dia menjalani kehidupan akademi ninja, dia masih tidak memiliki teman dan dia juga tidak punya ambisi. Tapi ada satu orang yang selalu menemani dia, yakni Iruka-Sensei, ia adalah guru akademi di kelas naruto.",
  "Ada suatu insiden, dimana naruto dihasut oleh orang tidak dikenal untuk mencuri segel rahasia di gudang terlarang.",
  "Singkat cerita, Naruto bertemu dengan orang yang tidak dikenal tersebut, tetapi ia malah ingin dibunuh, untung saja ada Iruka yang menolong naruto dan tidak menyalahkannya sama sekali.",
].join("\n\n");

/** What the teacher typed in the chat, verbatim. */
const CHAT = {
  sealing:
    "Ketika insiden tersebut kedua orang tua naruto menyegel Kurama (monster ekor sembilan) tersebut ke dalam tubuh Naruto agar monster tersebut tidak mengamuk di desa. Ketika proses penyegelan tersebut, kedua orang tuanya tertusuk oleh monster ekor sembilan dan meninggal",
  forgot: "tidak tahu, saya lupa",
  rumor:
    "Hal itu terjadi karena ada yang menyebarkan rumor tentang hal itu, saya tidak tahu pasti siapa yang menyebarkan dan apa alasannya",
  traitor:
    "Setahu saya dia adalah ninja dengan ranking setara dengan Iruka, dan dia juga adalah teman dari Iruka, tetapi dia adalah seorang pengkhianat",
  hidden:
    "Letak gudang penyimpanan jurus tersebut tersembunyi dan hanya segelintir orang yang tahu, jadi tidak semua ninja bisa mencurinya. Naruto bisa tahu tempat tersebut karena diberitahu oleh orang tidak dikenal tersebut. Dan jika berhasil mencuri pasti akan menjadi ninja buronan yang dikejar satu desa",
  stillChased: "Tetap dikejar",
};

/** The three what-ifs the student asked in a row at the end of the session. */
const WHAT_IFS = [
  "What stops a whole group of rogue ninja from doing the exact same thing to steal all the village's forbidden jutsu at once?",
  "If even a Hokage or a legendary hero stole a forbidden scroll, would the whole village still hunt them down as a rogue ninja just the same?",
  "What if an entire clan of elite ninja stole the scroll together instead of just one traitor, would they still just be chased down normally?",
];

function state(overrides: Partial<LearnerState> = {}): LearnerState {
  return {
    sessionId: "ses_naruto",
    understoodConcepts: ["forbidden scroll incident", "traitorous nature of the stranger"],
    activeMisconceptions: [],
    openGaps: [],
    questionsAsked: [],
    askedConcepts: [],
    updatedAtTurn: 3,
    ...overrides,
  };
}

/** A chat reply: the board's turn index stays where the last board left it. */
function chat(text: string, currentState: LearnerState) {
  return { sessionId: "ses_naruto", turnIndex: 3, teachingText: text, currentState, locale: "id" as const };
}

function proposes(
  text: string,
  options: { concept?: string; followsUp?: boolean; extend?: boolean; type?: string } = {},
) {
  return {
    nextState: state(),
    action: { kind: "respond", strategy: options.extend ? "extend_example" : "ask_clarification" },
    response: {
      type: options.type ?? "question",
      text,
      targetConcept: options.concept ?? "consequences of scroll theft",
      derivedFrom: "new_info",
      followsUp: options.followsUp ?? false,
    },
  } as unknown as Parameters<typeof normalizeLearnerOutput>[0];
}

function styleOf(input: ReturnType<typeof chat>): string {
  const user = buildLearnerMessages(input).find((m) => m.role === "user")!.content;
  return user.split("BEHAVIOR STYLE THIS TURN ═══")[1].trim().split(":")[0];
}

// --- M1: pacing by reply, not by board turn ----------------------------------

describe("pacing follows the conversation, not the board", () => {
  it("counts every reply, board or chat, and falls back to the turn index for older states", () => {
    expect(replyIndex(chat(CHAT.traitor, state({ exchangeCount: 7 })))).toBe(7);
    expect(replyIndex(chat(CHAT.traitor, state()))).toBe(3);

    const out = normalizeLearnerOutput(proposes("Who was he, then?"), chat(CHAT.traitor, state({ exchangeCount: 7 })));
    expect(out.nextState.exchangeCount).toBe(8);

    const failed = createFallbackOutput(chat(CHAT.traitor, state({ exchangeCount: 7 })));
    expect(failed.nextState.exchangeCount).toBe(8);
  });

  it("varies the voice across consecutive chat replies on the same board turn", () => {
    // The real session: three chat replies after the third board turn, all
    // with turn index 3, all tsundere. Now three replies, three styles.
    const styles = [9, 10, 11].map((n) => styleOf(chat(CHAT.hidden, state({ exchangeCount: n }))));
    expect(new Set(styles).size).toBe(3);
  });

  it("nudges toward a bigger case on one reply in three, not on every chat reply", () => {
    const nudged = [9, 10, 11].map((n) => shouldExtendThisTurn(chat(CHAT.hidden, state({ exchangeCount: n }))));
    expect(nudged.filter(Boolean)).toHaveLength(1);
  });

  it("tells a nudged student to follow a story forward, never to invent a what-if", () => {
    // Asked only to try "a bigger case", the student met a story lesson with a
    // made-up what-if on 6 runs of 6 against the real model.
    const nudged = chat(CHAT.hidden, state({ exchangeCount: 9 }));
    expect(shouldExtendThisTurn(nudged)).toBe(true);

    const user = buildLearnerMessages(nudged).find((m) => m.role === "user")!.content;
    expect(user).toMatch(/story, history or a chain of events, ask what it led to/);
    expect(user).toMatch(/Do NOT invent a "what\s+if"/);
  });

  it("does not nudge right after a question that already led away", () => {
    const input = chat(CHAT.hidden, state({ exchangeCount: 9, followUpDepth: MAX_FOLLOW_UP_DEPTH }));
    expect(shouldExtendThisTurn(input)).toBe(false);
  });
});

// --- M1: what-ifs count as leading away --------------------------------------

describe("a 'what if' is a step away from the lesson", () => {
  it("lets one through, then brings the second back to the lesson", () => {
    const first = normalizeLearnerOutput(
      proposes(WHAT_IFS[0], { extend: true, concept: "forbidden scroll incident" }),
      chat(CHAT.traitor, state({ exchangeCount: 9 })),
    );
    expect(first.response.type).toBe("question");
    expect(first.nextState.followUpDepth).toBe(1);

    const second = normalizeLearnerOutput(
      proposes(WHAT_IFS[1], { extend: true }),
      chat(CHAT.hidden, first.nextState),
    );
    expect(second.response.type).toBe("acknowledgment");
    expect(second.response.text).toBe(backToLessonText(CHAT.hidden, "id"));
    expect(second.nextState.followUpDepth).toBe(0);
  });

  it("never asks two in a row across the whole run from the session", () => {
    let current = state({ exchangeCount: 9 });
    const answers = [CHAT.traitor, CHAT.hidden, CHAT.stillChased];
    const kinds = WHAT_IFS.map((question, i) => {
      const out = normalizeLearnerOutput(
        proposes(question, { extend: true, concept: `what-if ${i}` }),
        chat(answers[i], current),
      );
      current = out.nextState;
      return out.response.type;
    });

    for (let i = 1; i < kinds.length; i++) {
      expect(kinds[i - 1] === "question" && kinds[i] === "question").toBe(false);
    }
  });
});

// --- M2: partial answers are not refusals ------------------------------------

describe("reading the teacher's limit", () => {
  it("tells an answer with one admitted gap from a refusal", () => {
    expect(readBoundary(CHAT.rumor)).toEqual({ extent: "partial", reason: "unknown" });
    expect(readBoundary(CHAT.forgot)).toEqual({ extent: "full", reason: "forgot" });
    expect(
      readBoundary(
        "saya tidak bisa menjelaskannya karena itu diluar lingkup materi yang saya pelajari, di referensi juga tidak ada",
      ),
    ).toEqual({ extent: "full", reason: "out_of_scope" });
  });

  it("finds no limit in the teacher's ordinary answers", () => {
    for (const text of [CHAT.sealing, CHAT.traitor, CHAT.hidden, CHAT.stillChased, BOARD_1, BOARD_3_NEW]) {
      expect(readBoundary(text)).toEqual({ extent: "none" });
    }
  });

  it("does not take the app's own section headings as explanation", () => {
    const text = composeTeachingText(
      {
        snapshotId: "snap",
        transcribedText: "saya tidak tahu",
        newText: "saya tidak tahu",
        elements: [],
        confidence: 1,
        needsConfirmation: false,
      },
      null,
    );
    expect(readBoundary(text)).toEqual({ extent: "full", reason: "unknown" });
  });

  it("lets a partial answer stand instead of calling it out of scope", () => {
    // What used to happen: "Ahh, fair enough, that's beyond our material."
    const out = normalizeLearnerOutput(
      proposes("So who exactly spread the rumor, and why?", { followsUp: true, concept: "rumor spreader" }),
      chat(CHAT.rumor, state({ exchangeCount: 6 })),
    );
    expect(out.response.type).toBe("acknowledgment");
    expect(out.response.text).toBe(partialBoundaryText(CHAT.rumor, "id"));
    expect(out.response.text).not.toMatch(/di luar|beyond/i);
  });

  it("still lets the student ask about the lesson after a partial answer", () => {
    const out = normalizeLearnerOutput(
      proposes("Jadi Naruto tumbuh sendirian tanpa teman sama sekali?", { concept: "Naruto social isolation" }),
      chat(CHAT.rumor, state({ exchangeCount: 6 })),
    );
    expect(out.response.type).toBe("question");
  });

  it("answers a refusal in the session's language, in words that fit why", () => {
    const out = normalizeLearnerOutput(
      proposes("What did his parents have to give up?", { followsUp: true, concept: "sacrifice" }),
      chat(CHAT.forgot, state({ exchangeCount: 3 })),
    );
    expect(out.response.type).toBe("acknowledgment");
    expect(out.response.text).toBe(boundaryText(CHAT.forgot, "forgot", "id"));
    expect(out.response.text).toMatch(/lupa/);
  });
});

// --- M3: every fixed line speaks the session's language ----------------------

describe("fixed lines in the session's language", () => {
  const LINES = {
    id: [
      boundaryText("a", "out_of_scope", "id"),
      boundaryText("b", "unknown", "id"),
      boundaryText("c", "forgot", "id"),
      partialBoundaryText("d", "id"),
      backToLessonText("e", "id"),
      moveOnText("segel rahasia", 1, "id"),
      moveOnText(undefined, 2, "id"),
    ],
    en: [
      boundaryText("a", "out_of_scope", "en"),
      boundaryText("b", "unknown"),
      boundaryText("c", "forgot", "en"),
      partialBoundaryText("d"),
      backToLessonText("e", "en"),
      moveOnText("the seal", 1, "en"),
      moveOnText(undefined, 2),
    ],
  };

  it("has an Indonesian line for every case, and English without a language", () => {
    for (const line of LINES.id) expect(line).toMatch(/\b(?:aku|kita|nggak|oke|sip|yuk|ya)\b/i);
    for (const line of LINES.en) expect(line).toMatch(/\b(?:let's|lesson|material|next)\b/i);
  });

  it("keeps every line short and in the student's role", () => {
    for (const line of [...LINES.id, ...LINES.en]) expect(isLearnerTextSafe(line)).toBe(true);
  });

  it("falls back in the session's language when the model call fails", () => {
    const out = createFallbackOutput(chat(CHAT.traitor, state()));
    expect(out.response.text).toMatch(/Aku masih agak bingung/);
  });
});

// --- M4: the teacher's names -------------------------------------------------

describe("the student keeps to the teacher's names", () => {
  it("collects names written mid-sentence and skips words capitalised only by grammar", () => {
    const names = namesIn(`${BOARD_1}\n\n${BOARD_3_NEW}`);

    for (const name of ["Uzumaki", "Minato", "Namikaze", "Kushina", "Kurama", "Konoha", "Iruka-Sensei", "Naruto"]) {
      expect(names).toContain(name);
    }
    for (const grammar of ["Ketika", "Karena", "Singkat", "Ada", "Tapi"]) {
      expect(names).not.toContain(grammar);
    }
  });

  it("adds a session's names as it goes, without duplicates, newest last, capped", () => {
    const first = nextTeacherTerms(undefined, BOARD_1);
    const second = nextTeacherTerms(first, CHAT.sealing);

    expect(second.filter((t) => t.toLowerCase() === "kurama")).toHaveLength(1);
    expect(second[second.length - 1]).toBe("Naruto");

    const letter = (n: number) => String.fromCharCode(97 + n);
    const many = Array.from({ length: 60 }, (_, i) => `ada Tokoh${letter(Math.floor(i / 26))}${letter(i % 26)} di sini`).join(". ");
    expect(nextTeacherTerms(undefined, many)).toHaveLength(MAX_TEACHER_TERMS);
  });

  it("remembers them in the state and shows them back in the prompt", () => {
    const out = normalizeLearnerOutput(proposes("Siapa Iruka-Sensei itu?"), chat(BOARD_3_NEW, state({ exchangeCount: 4 })));
    expect(out.nextState.teacherTerms).toEqual(expect.arrayContaining(["Iruka-Sensei", "Naruto"]));

    const user = buildLearnerMessages(chat(CHAT.hidden, out.nextState)).find((m) => m.role === "user")!.content;
    expect(user).toMatch(/Names the teacher has used[^\n]*Iruka-Sensei/);
  });

  it("tells the student not to swap in names it knows from elsewhere", () => {
    const system = buildLearnerMessages(chat(CHAT.hidden, state())).find((m) => m.role === "system")!.content;
    expect(system).toMatch(/only\s+know what THIS teacher has told you/);
    expect(system).toMatch(/Call people, places and things only by the names the teacher used/);
  });
});
