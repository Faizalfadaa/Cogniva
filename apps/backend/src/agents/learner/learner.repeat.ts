/**
 * How often the student may press on the same core question (§3.6).
 *
 * Left alone, the student circles: the user explains, the model is still not
 * satisfied, and it asks the same thing again in slightly different words. The
 * user then spends the session stuck on one concept instead of teaching the rest
 * of the material — which is the whole point of the session.
 *
 * So one core concept may be probed at most MAX_SAME_CONCEPT_QUESTIONS times.
 * On the next attempt the student accepts what it was taught and asks to move
 * on. The underlying gap is NOT marked understood: the Evaluator still reads the
 * real gaps and misconceptions from the state, so accepting the explanation is a
 * conversational move, not a claim that the user got it right.
 *
 * The counting lives here, not only in the prompt, because a model cannot be
 * relied on to count its own questions across turns. The prompt states the rule
 * as well, so the student's own wording follows it when the model does comply;
 * this module is what makes it true either way.
 */

import {
  AskedConcept,
  LearnerResponseType,
  LearnerState
} from "./learner.types";

/** Two questions on one concept is plenty; the third becomes "let's move on". */
export const MAX_SAME_CONCEPT_QUESTIONS = 2;

/** Keep the tally bounded — a long session only needs its recent concepts. */
const MAX_TRACKED_CONCEPTS = 40;

/** Response types that press the user for more on a concept. */
const probingTypes: LearnerResponseType[] = ["question", "confusion"];

/**
 * Words that carry no topic meaning, so "how does the light reaction work" and
 * "the light reaction" collapse onto the same key. Both languages appear here
 * because a session runs in one of them but technical terms often stay English.
 */
const stopwords = new Set([
  // English
  "a", "an", "the", "of", "in", "on", "at", "for", "to", "and", "or", "but",
  "is", "are", "was", "were", "be", "it", "its", "this", "that", "these",
  "those", "how", "what", "why", "when", "which", "who", "does", "do", "did",
  "can", "could", "would", "should", "about", "with", "from", "into", "than",
  "then", "there", "here", "work", "works", "working", "part", "parts",
  "concept", "concepts", "thing", "things", "idea", "ideas", "again", "still",
  "really", "just", "so", "if", "not", "no", "yes",
  // Indonesian
  "yang", "ini", "itu", "dan", "atau", "di", "ke", "dari", "untuk", "pada",
  "adalah", "merupakan", "apa", "kenapa", "mengapa", "bagaimana", "gimana",
  "bagian", "konsep", "hal", "sih", "kah", "juga", "lagi", "masih", "belum",
  "tidak", "bukan", "iya", "sama", "dengan", "kalau", "jika", "saja"
]);

/**
 * Reduce a concept (or, failing that, a question) to a comparison key: the set
 * of its meaningful words, sorted. Word order and filler drop out, so a reworded
 * repeat of the same question lands on the key it landed on last turn.
 */
export function conceptKey(value: string): string {
  const words = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !stopwords.has(word));

  return Array.from(new Set(words)).sort().join(" ");
}

/** True for the response types that keep the user on the same concept. */
export function isProbingType(type: LearnerResponseType): boolean {
  return probingTypes.includes(type);
}

/**
 * The key a response is counted under: its declared concept, or the question
 * text when the model gave no concept. An empty key means there is nothing
 * recognizable to count, and the response passes through untouched.
 */
export function probeKey(
  targetConcept: string | undefined,
  text: string
): string {
  return conceptKey(targetConcept ?? "") || conceptKey(text);
}

/**
 * The tallied concept this key belongs to, if any.
 *
 * Not plain equality: the student names the same concept at different lengths
 * from turn to turn ("the role of light", then just "light"), and each spelling
 * would otherwise start a fresh count and buy itself two more questions. Two
 * keys are the same concept when one's words are contained in the other's AND
 * the shared words are at least half of the longer one — so "light" folds into
 * "light role", while "reaction" stays distinct from "light dark reaction".
 */
export function matchProbe(
  state: LearnerState,
  key: string
): AskedConcept | undefined {
  if (!key) return undefined;

  const words = toWordSet(key);

  return (state.askedConcepts ?? []).find((entry) =>
    sameConcept(words, toWordSet(entry.key))
  );
}

/** How many times the student has already probed this concept. */
export function countProbes(state: LearnerState, key: string): number {
  return matchProbe(state, key)?.count ?? 0;
}

function toWordSet(key: string): Set<string> {
  return new Set(key.split(" ").filter(Boolean));
}

function sameConcept(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;

  const shared = Array.from(a).filter((word) => b.has(word)).length;

  if (shared === 0) return false;

  const contained = shared === Math.min(a.size, b.size);

  return contained && shared * 2 >= Math.max(a.size, b.size);
}

/** True once the student has spent its two questions on this concept. */
export function isRepeatExhausted(state: LearnerState, key: string): boolean {
  return countProbes(state, key) >= MAX_SAME_CONCEPT_QUESTIONS;
}

/** The tally for the next state, with this probe counted in. */
export function recordProbe(
  state: LearnerState,
  key: string,
  label: string
): AskedConcept[] {
  const carried = state.askedConcepts ?? [];

  if (!key) return [...carried];

  // Counted against the concept it already belongs to, keeping that entry's key
  // and label so the tally stays one concept rather than two spellings of it.
  const existing = matchProbe(state, key);
  const updated: AskedConcept[] = existing
    ? carried.map((entry) =>
        entry.key === existing.key
          ? { ...entry, label: entry.label || label, count: entry.count + 1 }
          : entry
      )
    : [...carried, { key, label, count: 1 }];

  // Oldest entries go first: a concept from twenty turns ago is not what the
  // student is stuck on now.
  return updated.slice(-MAX_TRACKED_CONCEPTS);
}

/** Concepts the student may no longer ask about, for the prompt to name. */
export function conceptsAtLimit(state: LearnerState): string[] {
  return (state.askedConcepts ?? [])
    .filter((entry) => entry.count >= MAX_SAME_CONCEPT_QUESTIONS)
    .map((entry) => entry.label || entry.key)
    .filter(Boolean);
}

/**
 * What the student says instead of asking a third time: it takes the
 * explanation as given and hands the floor back for the next material.
 *
 * Still the student's voice — accepting an explanation, not judging it — and
 * varied by turn so a long session doesn't repeat one sentence. English, like
 * every other line the Learner produces.
 */
export function moveOnText(
  targetConcept: string | undefined,
  turnIndex: number
): string {
  const concept = (targetConcept ?? "").trim();

  const withConcept = [
    `Okay, I think I get ${concept} now from how you explained it. Can we move on to the next part?`,
    `Ohh, alright — ${concept} makes enough sense to me now. What comes next?`,
    `Got it, I'll go with your explanation of ${concept}. Let's keep going to the next material.`
  ];

  const withoutConcept = [
    "Okay, I think I get that now from how you explained it. Can we move on to the next part?",
    "Ohh, alright — that makes enough sense to me now. What comes next?",
    "Got it, I'll go with your explanation. Let's keep going to the next material.",
  ];

  const variants = concept ? withConcept : withoutConcept;

  return variants[Math.abs(turnIndex) % variants.length];
}
