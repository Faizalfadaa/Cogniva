/**
 * The names the teacher has used, so the student calls things by them (§3.6).
 *
 * The student is meant to know only what it was taught. On a famous topic the
 * model knows more: taught a story where the teacher wrote "segel rahasia" (a
 * secret seal), the student asked about the "forbidden scroll", a name the
 * teacher never used, from the version of the story the model already knew.
 * Its recorded misconception even said the seal was "a scroll of ninjutsu
 * techniques" rather than a lock, which is the model correcting the teacher
 * from outside knowledge, the one thing the student must not do.
 *
 * A prompt rule alone ("don't use outside knowledge") was already there. What
 * the model lacked was the list to hold itself to: across a session the
 * teacher's names are spread over many turns and chat messages, and the
 * student only ever sees the current one. So the names are collected here, as
 * the session goes, and the prompt shows them back as the student's whole
 * vocabulary for people, places and things.
 *
 * Proper names only, found by capitalisation mid-sentence. They are where the
 * student swapped in names of its own, and they are cheap to find without a
 * model call. Common nouns are left to the prompt rule.
 */

import { EARLIER_BOARD_HEADING, THIS_TURN_HEADINGS } from "./learner.depth";

/** Enough to cover a lesson's cast and places without crowding the prompt. */
export const MAX_TEACHER_TERMS = 40;

/**
 * A capitalised word, letters and joined parts only ("Iruka-Sensei",
 * "O'Neil"). Three letters at least, so "I" and "Ia" never count.
 */
const NAME = /\p{Lu}[\p{L}'’-]*\p{L}/gu;

/** Characters that end a sentence; a capital right after one is just a sentence start. */
const SENTENCE_END = /[.!?:\n]/;

/**
 * Capitalised words in `text` that are not at the start of a sentence.
 *
 * A word at a sentence start is capitalised by grammar, not because it is a
 * name, so it only counts if the same word also appears capitalised somewhere
 * mid-sentence. "Ketika dia..." gives nothing; "anak dari Minato Namikaze"
 * gives both names.
 */
export function namesIn(text: string): string[] {
  let source = text;
  for (const heading of [EARLIER_BOARD_HEADING, ...THIS_TURN_HEADINGS]) {
    source = source.split(heading).join("\n");
  }

  const found: string[] = [];
  for (const match of source.matchAll(NAME)) {
    const word = match[0];
    if (word.length < 3) continue;
    const before = source.slice(0, match.index).trimEnd();
    const startsSentence = before.length === 0 || SENTENCE_END.test(before[before.length - 1]);
    if (!startsSentence) found.push(word);
  }
  return found;
}

/**
 * The vocabulary for the next state: what was carried over, plus the names in
 * this turn's teaching, without duplicates (ignoring case) and newest last, so
 * the cap drops the names the lesson has moved on from.
 */
export function nextTeacherTerms(previous: string[] | undefined, teachingText: string): string[] {
  const merged = [...(previous ?? [])];
  for (const name of namesIn(teachingText)) {
    const at = merged.findIndex((term) => term.toLowerCase() === name.toLowerCase());
    if (at >= 0) merged.splice(at, 1);
    merged.push(name);
  }
  return merged.slice(-MAX_TEACHER_TERMS);
}
