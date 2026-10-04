/**
 * How far the student may follow the teacher away from the lesson (§3.6).
 *
 * The repeat limit (learner.repeat.ts) stops the student asking about one
 * concept a third time. It cannot stop a chain, because every link in a chain
 * is a different concept. The teacher explains the urethra, the student asks
 * how it keeps urine and sperm apart; the teacher mentions a valve, the student
 * asks how the valve knows when to close; the teacher mentions a muscle, then
 * the sympathetic nervous system, and each answer hands the student a new term
 * to ask about. No concept is ever asked about twice, the limit never fires,
 * and the user ends up researching nerve physiology in the middle of a lesson
 * on reproductive anatomy that never mentioned it.
 *
 * A question about the lesson is what the session is for. One question about
 * how the teacher's own answer works is healthy curiosity, and it makes the
 * teacher check that they understand what they said. The second in a row is a
 * drill, and it leads away from the material the user came to teach. So this
 * module counts the drill, and holds it to one step. A "what if it were
 * bigger" question (learner.extend.ts) leads away just the same, so it is
 * counted in the same chain: a story lesson once ended in three what-ifs in a
 * row about who else might steal the scroll, each under a new concept label.
 *
 * It also handles the other way a chain should end: the teacher saying so. "I
 * can't explain that, it's outside the material" is an answer, and the student
 * used to meet it by asking for everything else instead. Saying so is not
 * always the whole answer, though: "it was a rumor, I don't know exactly who
 * spread it" answers the question and only admits a gap in one detail, and
 * meeting that with "that's beyond our material" ignored what was said. So the
 * teacher's message is read clause by clause (readBoundary).
 *
 * Both are enforced here and not only in the prompt, for the reason
 * learner.repeat.ts gives: a model cannot be relied on to count across turns,
 * and it followed "dig deeper" more readily than any instruction to stop.
 */

import type { Locale } from "../../contracts/workspace.js";
import { conceptKey, isProbingType } from "./learner.repeat";
import { LearnerResponse, LearnerState } from "./learner.types";

/**
 * Questions allowed in a row that lead away from the lesson: following up how
 * the teacher's own answer works, or pushing it to a bigger "what if" case.
 *
 * One: enough to make the teacher check their own explanation, not enough to
 * walk them out of the material.
 */
export const MAX_FOLLOW_UP_DEPTH = 1;

/**
 * The heading composeTeachingText puts over the board as a whole.
 *
 * Everything after it is earlier material shown for context. A boundary the
 * teacher wrote there turns ago is not one they set now, so the search stops
 * at this line. Shared with composeTeachingText so the two cannot drift apart.
 */
export const EARLIER_BOARD_HEADING = "The whole board as it stands now";

/**
 * The other headings composeTeachingText writes above this turn's material.
 * They are the app's words, not the teacher's, so they are dropped before the
 * message is read; left in, "Just added to the board this turn" would count
 * as a sentence of explanation. Shared for the same reason as the one above.
 */
export const THIS_TURN_HEADINGS = [
  "Just added to the board this turn:",
  "Said out loud this turn:",
  "How the drawing and the talking lined up:",
  "(nothing new was drawn on the board this turn)",
] as const;

/** Why the teacher can't take the question further. */
export type BoundaryReason = "unknown" | "out_of_scope" | "forgot";

/**
 * How much of the teacher's message is a boundary.
 *
 * "full": it is all a refusal ("I don't know", "that's outside the material").
 * "partial": it answers, and admits a gap in part of it.
 * "none": no boundary at all.
 */
export type BoundaryReading =
  | { extent: "none" }
  | { extent: "partial" | "full"; reason: BoundaryReason };

// First person, then a negation, then knowing or understanding. The pronoun is
// required: "banyak orang tidak tahu bahwa..." is teaching, not a boundary.
const ID_ME = "(?:saya|aku|gue|gua|gw)";
const ID_NOT = "(?:tidak|tak|gak|ga|nggak|ngga|enggak|engga|kurang|belum)";
const ID_SOURCE = "(?:referensi|materi|buku|modul|pdf|catatan|bahan)";

/**
 * Ways a teacher says "I can't take this further", in both languages a session
 * runs in, by reason. Specific on purpose: a false positive costs the student
 * one question it could have asked, but a pattern loose enough to catch "tidak
 * bisa mengeluarkan" would end questions about the lesson itself.
 */
const BOUNDARY_PATTERNS: { reason: BoundaryReason; pattern: RegExp }[] = [
  // "di luar lingkup materi", "diluar cakupan"
  { reason: "out_of_scope", pattern: /\bdi\s?luar\s+(?:lingkup|cakupan|materi|pembahasan|bahasan|topik|konteks|silabus|referensi)\b/ },
  // "tidak ada di referensi", "tidak dibahas dalam materi"
  {
    reason: "out_of_scope",
    pattern: new RegExp(
      `\\b${ID_NOT}\\s+(?:ada|dibahas|dijelaskan|disebutkan|tercantum|diajarkan)\\s+(?:di|dalam|pada)\\s+${ID_SOURCE}\\b`,
    ),
  },
  // "di referensi juga tidak ada"
  {
    reason: "out_of_scope",
    pattern: new RegExp(
      `\\b(?:di|dalam|pada)\\s+${ID_SOURCE}(?:nya)?\\s+(?:juga\\s+)?(?:tidak|gak|ga|nggak|enggak)\\s+(?:ada|dibahas|dijelaskan)\\b`,
    ),
  },
  // "belum saya pelajari", "tidak aku pelajari"
  { reason: "out_of_scope", pattern: new RegExp(`\\b(?:tidak|belum|gak|nggak)\\s+${ID_ME}\\s+pelajari\\b`) },
  // "bukan bagian dari materi"
  { reason: "out_of_scope", pattern: /\bbukan\s+(?:bagian|cakupan|ranah)\s+(?:dari\s+)?(?:materi|pembahasan|topik)\b/ },
  // "out of scope", "outside the material", "beyond what I studied"
  {
    reason: "out_of_scope",
    pattern: /\b(?:out\s+of|outside(?:\s+of)?|beyond)\s+(?:the\s+|my\s+|our\s+)?(?:scope|material|syllabus|reference|what\s+i\s+(?:studied|learned|learnt))\b/,
  },
  // "not in the reference", "not covered in my notes"
  { reason: "out_of_scope", pattern: /\bnot\s+(?:in|covered\s+in|part\s+of)\s+(?:the\s+|my\s+)?(?:reference|material|notes|book|syllabus)\b/ },

  // "saya lupa", "aku udah lupa"
  { reason: "forgot", pattern: new RegExp(`\\b${ID_ME}\\s+(?:juga\\s+|sudah\\s+|udah\\s+|agak\\s+)?lupa\\b`) },
  // "saya tidak ingat", "aku gak inget"
  { reason: "forgot", pattern: new RegExp(`\\b${ID_ME}\\s+(?:juga\\s+|sudah\\s+|udah\\s+)?${ID_NOT}\\s+(?:ingat|inget)\\b`) },
  // a clause that is only "lupa" or "tidak ingat"
  { reason: "forgot", pattern: /^(?:lupa|(?:tidak|gak|ga|nggak|enggak)\s+(?:ingat|inget))$/ },
  // "I forgot", "I don't remember"
  { reason: "forgot", pattern: /\bi\s+(?:forgot|forget|(?:don'?t|do\s+not|can'?t|cannot)\s+remember)\b/ },

  // "saya tidak tahu", "aku juga gak ngerti", "saya belum paham"
  {
    reason: "unknown",
    pattern: new RegExp(
      `\\b${ID_ME}\\s+(?:juga\\s+|masih\\s+|sendiri\\s+|pun\\s+)?${ID_NOT}\\s+(?:tahu|tau|paham|mengerti|ngerti)\\b`,
    ),
  },
  // a clause that is only "tidak tahu" or "entah"
  { reason: "unknown", pattern: /^(?:(?:tidak|gak|ga|nggak|ngga|enggak|engga)\s+(?:tahu|tau)|entah|entahlah)$/ },
  // "tidak bisa menjelaskannya", "gak bisa jelasin"
  {
    reason: "unknown",
    pattern: new RegExp(`\\b${ID_NOT}\\s+(?:bisa|dapat|mampu|sanggup)\\s+(?:men)?jelas(?:kan|in)(?:nya)?\\b`),
  },
  // "I don't know", "I really don't know"
  { reason: "unknown", pattern: /\bi\s+(?:really\s+)?(?:don'?t|do\s+not)\s+(?:really\s+)?know\b/ },
  { reason: "unknown", pattern: /\bi\s+have\s+no\s+idea\b/ },
  // "I can't explain that"
  { reason: "unknown", pattern: /\b(?:can'?t|cannot|can\s+not|couldn'?t)\s+explain\b/ },
];

/**
 * When several clauses give different reasons, the most informative wins:
 * "it's outside the material" says more than "I don't know", and "I forgot"
 * says more than "I don't know" too.
 */
const REASON_PRIORITY: BoundaryReason[] = ["out_of_scope", "forgot", "unknown"];

/**
 * A clause needs this many meaningful words to count as explanation. "Itu
 * terjadi karena ada rumor" has four; "pasti" or "ya begitu" has none.
 */
const MIN_EXPLAINING_WORDS = 3;

/** Clause breaks: sentence ends, commas, and the "but" that joins an answer to an admission. */
const CLAUSE_BREAK = /[.!?;\n]+|,\s+|\s+(?:tapi|tetapi|namun|but)\s+/;

/**
 * Read what the teacher said this turn for a boundary, clause by clause.
 *
 * A clause that matches a boundary pattern is an admission; any other clause
 * with enough meaningful words is explanation. Admissions alone make a "full"
 * boundary; admissions next to explanation make a "partial" one.
 */
export function readBoundary(teachingText: string): BoundaryReading {
  let thisTurn = teachingText.split(EARLIER_BOARD_HEADING)[0] ?? "";
  for (const heading of THIS_TURN_HEADINGS) thisTurn = thisTurn.split(heading).join("\n");

  const clauses = thisTurn
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(CLAUSE_BREAK)
    .map((clause) => clause.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const reasons = new Set<BoundaryReason>();
  let explains = false;

  for (const clause of clauses) {
    const match = BOUNDARY_PATTERNS.find(({ pattern }) => pattern.test(clause));
    if (match) {
      reasons.add(match.reason);
    } else if (conceptKey(clause).split(" ").filter(Boolean).length >= MIN_EXPLAINING_WORDS) {
      explains = true;
    }
  }

  if (reasons.size === 0) return { extent: "none" };

  const reason = REASON_PRIORITY.find((r) => reasons.has(r))!;
  return { extent: explains ? "partial" : "full", reason };
}

/**
 * True when the teacher said this turn that they can't take a question
 * further, whether that is the whole message or only part of it.
 */
export function teacherSetBoundary(teachingText: string): boolean {
  return readBoundary(teachingText).extent !== "none";
}

/** True once the student has spent its one question away from the lesson. */
export function isDrillExhausted(state: LearnerState): boolean {
  return (state.followUpDepth ?? 0) >= MAX_FOLLOW_UP_DEPTH;
}

/**
 * The depth for the next state.
 *
 * Only a question that leads away from the lesson deepens the chain. Anything
 * else ends it: a question about the lesson, a paraphrase, or the
 * acknowledgment the student gives when it is held back.
 */
export function nextFollowUpDepth(
  state: LearnerState,
  response: LearnerResponse,
  leadsAway: boolean
): number {
  if (isProbingType(response.type) && leadsAway) {
    return (state.followUpDepth ?? 0) + 1;
  }
  return 0;
}

type Lines = Record<"en" | "id", string[]>;

const BOUNDARY_LINES: Record<BoundaryReason, Lines> = {
  out_of_scope: {
    en: [
      "Oh, okay, that one's outside what we're studying, so no worries. Let's go back to your lesson, what's next?",
      "Got it, we can leave that part for another time. Can we continue with the material you were teaching?",
      "Ahh, fair enough, that's beyond our material. Okay, let's keep going with the lesson, what comes after this?",
    ],
    id: [
      "Oh, oke, itu di luar yang kita pelajari ya, nggak apa-apa. Kita balik ke pelajaranmu aja, habis ini apa?",
      "Sip, bagian itu kita simpan buat lain kali aja. Lanjut ke materi yang tadi kamu ajarin ya?",
      "Ahh, iya juga, itu udah di luar materi kita. Oke, lanjut pelajarannya, setelah ini apa?",
    ],
  },
  unknown: {
    en: [
      "Oh, okay, no worries if you don't know that one. Let's go back to your lesson, what's next?",
      "That's fine, we can leave it there. Can we continue with the material you were teaching?",
      "Alright, no problem. Let's keep going with the lesson, what comes after this?",
    ],
    id: [
      "Oh, oke, nggak apa-apa kalau belum tahu. Kita balik ke pelajaranmu aja, habis ini apa?",
      "Sip, nggak masalah kok, kita biarin aja bagian itu. Lanjut ke materi yang tadi kamu ajarin ya?",
      "Oke, nggak apa-apa. Kita terusin pelajarannya aja, setelah ini apa?",
    ],
  },
  forgot: {
    en: [
      "Oh, you forgot? No worries, it'll come back to you. Let's go back to your lesson, what's next?",
      "That's okay, it happens. Can we continue with the material you were teaching?",
      "Alright, no problem. Let's keep going with the lesson, what comes after this?",
    ],
    id: [
      "Oh, lupa ya? Nggak apa-apa, nanti juga ingat lagi. Kita balik ke pelajaranmu aja, habis ini apa?",
      "Sip, wajar kok kalau lupa. Lanjut ke materi yang tadi kamu ajarin ya?",
      "Oke, santai aja. Kita terusin pelajarannya, setelah ini apa?",
    ],
  },
};

const PARTIAL_LINES: Lines = {
  en: [
    "Ohh, okay, that makes sense, thanks. The part you're not sure about is fine, let's keep going with the lesson.",
    "Got it, I'll go with what you told me. We can leave the rest, what comes next in the material?",
    "Okay, that helps. No worries about the other part, let's continue with your lesson.",
  ],
  id: [
    "Ohh, oke, masuk akal, makasih ya. Bagian yang belum pasti nggak apa-apa, kita lanjut pelajarannya aja.",
    "Sip, aku pegang penjelasanmu tadi. Sisanya biarin aja, habis ini materinya apa?",
    "Oke, itu membantu banget. Bagian yang lain nggak usah dipikirin, lanjut ke pelajaranmu ya.",
  ],
};

const BACK_TO_LESSON_LINES: Lines = {
  en: [
    "Okay, I'll take your word on how that part works. Let's get back to the lesson, what's next?",
    "Hmm, I think that's deep enough for me for now. Can we go back to the material you were teaching?",
    "Alright, I'll accept that explanation as it is. Let's continue with the next part of your lesson.",
  ],
  id: [
    "Oke, aku percaya penjelasanmu soal bagian itu. Balik ke pelajarannya yuk, habis ini apa?",
    "Hmm, kayaknya segini dulu dalamnya buat aku. Kita balik ke materi yang tadi kamu ajarin ya?",
    "Oke, aku terima penjelasannya apa adanya. Lanjut ke bagian berikutnya dari pelajaranmu ya.",
  ],
};

/**
 * What the student says when the whole message was the teacher setting a
 * boundary: it lets the question go without asking for "everything else" and
 * hands the floor back for the lesson, in words that fit why.
 *
 * In the session's language. Without one (the bare session API) it is
 * English, as every line was before sessions had a language.
 */
export function boundaryText(seed: string, reason: BoundaryReason, locale?: Locale): string {
  return pick(BOUNDARY_LINES[reason][lang(locale)], seed);
}

/**
 * What the student says when the teacher answered and admitted a gap in part
 * of it, and the student was about to ask about that part anyway: it takes
 * the answer and moves on.
 */
export function partialBoundaryText(seed: string, locale?: Locale): string {
  return pick(PARTIAL_LINES[lang(locale)], seed);
}

/**
 * What the student says instead of a second question in a row that leads away
 * from the lesson.
 *
 * It takes the teacher's answer as given, which is a conversational move and
 * not a claim that the answer was right, and steers back to the lesson.
 */
export function backToLessonText(seed: string, locale?: Locale): string {
  return pick(BACK_TO_LESSON_LINES[lang(locale)], seed);
}

/** Lines exist in English and Indonesian; anything else falls back to English. */
export function lang(locale: Locale | undefined): "en" | "id" {
  return locale === "id" ? "id" : "en";
}

/**
 * Choose a line by the text it answers.
 *
 * Not by turn index: chat replies all share the turn index of the last board,
 * so indexing by it would give every chat reply the same sentence. The text is
 * different on every message, and hashing it stays deterministic for tests.
 */
function pick(variants: string[], seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return variants[Math.abs(hash) % variants.length];
}
