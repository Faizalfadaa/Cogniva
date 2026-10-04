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
 * module counts the drill, and holds it to one step.
 *
 * It also handles the other way a chain should end: the teacher saying so. "I
 * can't explain that, it's outside the material" is an answer, and the student
 * used to meet it by asking for everything else instead.
 *
 * Both are enforced here and not only in the prompt, for the reason
 * learner.repeat.ts gives: a model cannot be relied on to count across turns,
 * and it followed "dig deeper" more readily than any instruction to stop.
 */

import { isProbingType } from "./learner.repeat";
import { LearnerResponse, LearnerState } from "./learner.types";

/**
 * Follow-up questions allowed in a row about how the teacher's own answer works.
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

// First person, then a negation, then knowing or understanding. The pronoun is
// required: "banyak orang tidak tahu bahwa..." is teaching, not a boundary.
const ID_ME = "(?:saya|aku|gue|gua|gw)";
const ID_NOT = "(?:tidak|tak|gak|ga|nggak|ngga|enggak|engga|kurang|belum)";
const ID_SOURCE = "(?:referensi|materi|buku|modul|pdf|catatan|bahan)";

/**
 * Ways a teacher says "I can't take this further", in both languages a session
 * runs in. Specific on purpose: a false positive costs the student one question
 * it could have asked, but a pattern loose enough to catch "tidak bisa
 * mengeluarkan" would end questions about the lesson itself.
 */
const BOUNDARY_PATTERNS: RegExp[] = [
  // "saya tidak tahu", "aku juga gak ngerti", "saya belum paham"
  new RegExp(
    `\\b${ID_ME}\\s+(?:juga\\s+|masih\\s+|sendiri\\s+|pun\\s+)?${ID_NOT}\\s+(?:tahu|tau|paham|mengerti|ngerti)\\b`,
  ),
  // "tidak bisa menjelaskannya", "gak bisa jelasin"
  new RegExp(
    `\\b${ID_NOT}\\s+(?:bisa|dapat|mampu|sanggup)\\s+(?:men)?jelas(?:kan|in)(?:nya)?\\b`,
  ),
  // "di luar lingkup materi", "diluar cakupan"
  /\bdi\s?luar\s+(?:lingkup|cakupan|materi|pembahasan|bahasan|topik|konteks|silabus|referensi)\b/,
  // "tidak ada di referensi", "tidak dibahas dalam materi"
  new RegExp(
    `\\b${ID_NOT}\\s+(?:ada|dibahas|dijelaskan|disebutkan|tercantum|diajarkan)\\s+(?:di|dalam|pada)\\s+${ID_SOURCE}\\b`,
  ),
  // "di referensi juga tidak ada"
  new RegExp(
    `\\b(?:di|dalam|pada)\\s+${ID_SOURCE}(?:nya)?\\s+(?:juga\\s+)?(?:tidak|gak|ga|nggak|enggak)\\s+(?:ada|dibahas|dijelaskan)\\b`,
  ),
  // "belum saya pelajari", "tidak aku pelajari"
  new RegExp(`\\b(?:tidak|belum|gak|nggak)\\s+${ID_ME}\\s+pelajari\\b`),
  // "bukan bagian dari materi"
  /\bbukan\s+(?:bagian|cakupan|ranah)\s+(?:dari\s+)?(?:materi|pembahasan|topik)\b/,

  // "I don't know", "I really don't know"
  /\bi\s+(?:really\s+)?(?:don'?t|do\s+not)\s+(?:really\s+)?know\b/,
  /\bi\s+have\s+no\s+idea\b/,
  // "I can't explain that"
  /\b(?:can'?t|cannot|can\s+not|couldn'?t)\s+explain\b/,
  // "out of scope", "outside the material", "beyond what I studied"
  /\b(?:out\s+of|outside(?:\s+of)?|beyond)\s+(?:the\s+|my\s+|our\s+)?(?:scope|material|syllabus|reference|what\s+i\s+(?:studied|learned|learnt))\b/,
  // "not in the reference", "not covered in my notes"
  /\bnot\s+(?:in|covered\s+in|part\s+of)\s+(?:the\s+|my\s+)?(?:reference|material|notes|book|syllabus)\b/,
];

/**
 * True when the teacher said this turn that they can't take the question
 * further: they don't know, can't explain it, or it's outside the material.
 */
export function teacherSetBoundary(teachingText: string): boolean {
  const thisTurn = teachingText.split(EARLIER_BOARD_HEADING)[0] ?? "";
  const text = thisTurn
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ");

  return BOUNDARY_PATTERNS.some((pattern) => pattern.test(text));
}

/** True once the student has spent its one follow-up on the teacher's answers. */
export function isDrillExhausted(state: LearnerState): boolean {
  return (state.followUpDepth ?? 0) >= MAX_FOLLOW_UP_DEPTH;
}

/**
 * The depth for the next state.
 *
 * Only a question that follows up the teacher's answer deepens the chain.
 * Anything else ends it: a question about the lesson, a paraphrase, or the
 * acknowledgment the student gives when it is held back.
 */
export function nextFollowUpDepth(
  state: LearnerState,
  response: LearnerResponse,
  followsUp: boolean
): number {
  if (isProbingType(response.type) && followsUp) {
    return (state.followUpDepth ?? 0) + 1;
  }
  return 0;
}

/**
 * What the student says when the teacher has set a boundary.
 *
 * It lets the question go without asking for "everything else" and hands the
 * floor back for the lesson. English, like every line the Learner speaks,
 * because the voice engines cannot say Indonesian (config TTS_LANGUAGE).
 */
export function boundaryText(seed: string): string {
  return pick(
    [
      "Oh, okay, that one's outside what we're studying, so no worries. Let's go back to your lesson, what's next?",
      "Got it, we can leave that part for another time. Can we continue with the material you were teaching?",
      "Ahh, fair enough, that's beyond our material. Okay, let's keep going with the lesson, what comes after this?",
    ],
    seed
  );
}

/**
 * What the student says instead of a second "but how does that work?".
 *
 * It takes the teacher's answer as given, which is a conversational move and
 * not a claim that the answer was right, and steers back to the lesson.
 */
export function backToLessonText(seed: string): string {
  return pick(
    [
      "Okay, I'll take your word on how that part works. Let's get back to the lesson, what's next?",
      "Hmm, I think that's deep enough for me for now. Can we go back to the material you were teaching?",
      "Alright, I'll accept that explanation as it is. Let's continue with the next part of your lesson.",
    ],
    seed
  );
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
