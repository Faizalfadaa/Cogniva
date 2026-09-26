/**
 * When the student pushes the material further instead of poking at it (§3.6).
 *
 * A student who only ever asks "what does that mean?" leaves the teacher
 * repeating the same explanation. The question that actually makes a teacher
 * think is the one that takes what they just taught and tries it somewhere
 * harder: taught how F0 becomes 240, the student asks how FFFFF would go. It
 * proves the idea landed and it forces the teacher past their own example.
 *
 * It must stay occasional. Every turn like that would make the student a quiz
 * master, and a beginner who extends everything is not a beginner. So it is
 * paced here — a nudge on some turns only, and only once there is something the
 * student claims to understand — and the model is free to ignore the nudge when
 * nothing is solid enough yet to build on.
 */

import { LearnerAgentInput } from "./learner.types";

/** One in this many turns invites an extending question. */
export const EXTEND_EVERY_TURNS = 3;

/**
 * Whether this turn is one where the student should try to stretch the idea.
 *
 * Not on the opening turn (nothing has been taught yet) and not while the
 * student understands nothing (there is nothing to extend — it should be asking
 * plain questions instead).
 */
export function shouldExtendThisTurn(input: LearnerAgentInput): boolean {
  if (input.turnIndex <= 0) return false;
  if (input.currentState.understoodConcepts.length === 0) return false;

  return input.turnIndex % EXTEND_EVERY_TURNS === 0;
}

/** A harder case derived from the teacher's own example. */
export type HarderCase = {
  /** The case the teacher used, as written on the board. */
  from: string;
  /** The bigger one the student asks about next. */
  to: string;
};

/**
 * Find the example the teacher worked through and build a harder version of it.
 *
 * Deliberately narrow: a hex/binary-looking token becomes a much longer one of
 * the same digit (F0 -> FFFFF, the case that motivated this), and a plain number
 * gains three digits (25 -> 25000). Anything else returns null, and the caller
 * asks its ordinary question instead of inventing a case it cannot justify.
 *
 * This is the offline path. With an LLM the prompt asks for the harder case,
 * because the model can pick a far better one than a regex can.
 */
export function harderCase(text: string): HarderCase | null {
  // A hex-ish token: digits and A-F, with at least one letter so it is not just
  // a number, and short enough that it is an example rather than a hash.
  const hex = text.match(/\b(?=[0-9A-F]{2,8}\b)[0-9A-F]*[A-F][0-9A-F]*\b/);
  if (hex) {
    const token = hex[0];
    const digit = token[0];
    return { from: token, to: digit.repeat(Math.max(5, token.length + 2)) };
  }

  const decimal = text.match(/\b\d{1,6}\b/);
  if (decimal) {
    return { from: decimal[0], to: `${decimal[0]}000` };
  }

  return null;
}
