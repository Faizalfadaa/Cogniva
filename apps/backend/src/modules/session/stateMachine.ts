/**
 * Session state machine (Architecture Document §4, with an agreed extension).
 *
 * The orchestrator is the only party allowed to move the status, and every
 * transition is triggered by a clear event.
 *
 *   SETUP --(start)--> TEACHING --(end)--> ENDED --(evaluate)--> EVALUATED
 *                          ^                                          |
 *                          +------------------(resume)---------------+
 *
 * Rules:
 * - teaching_input is only valid in the TEACHING state (§4.2).
 * - Triggering evaluation is only valid in the ENDED state, and is idempotent
 *   for the current round (§4.2).
 * - EXTENSION (supersedes the forward-only rule in §4.2, agreed change): a
 *   finished session is resumable — `resume` moves ENDED or EVALUATED back to
 *   TEACHING so the user can continue the conversation. Each ended round still
 *   produces its own EvaluationResult, and the prior results are kept as
 *   history rather than overwritten. EVALUATED is therefore no longer terminal.
 */

import type { SessionStatus } from "../../contracts/enums.js";

// Events that trigger transitions
export const START = "start";
export const END = "end";
export const EVALUATE = "evaluate";
export const RESUME = "resume";

export type SessionEvent =
  | typeof START
  | typeof END
  | typeof EVALUATE
  | typeof RESUME;

// Allowed transitions: `${status}:${event}` -> next status
const TRANSITIONS: Record<string, SessionStatus> = {
  [`SETUP:${START}`]: "TEACHING",
  [`TEACHING:${END}`]: "ENDED",
  [`ENDED:${EVALUATE}`]: "EVALUATED",
  // Resume a finished session to keep teaching (agreed extension).
  [`EVALUATED:${RESUME}`]: "TEACHING",
  [`ENDED:${RESUME}`]: "TEACHING",
};

/** A status transition that is not allowed by the state machine. */
export class InvalidTransition extends Error {
  constructor(
    readonly current: SessionStatus,
    readonly event: string,
  ) {
    super(`Invalid transition: event '${event}' in status '${current}'`);
    this.name = "InvalidTransition";
  }
}

/** Return the next status for (status, event), or throw InvalidTransition. */
export function nextStatus(current: SessionStatus, event: string): SessionStatus {
  const next = TRANSITIONS[`${current}:${event}`];
  if (next === undefined) {
    throw new InvalidTransition(current, event);
  }
  return next;
}

/** True if (status, event) is an allowed transition. */
export function canTransition(current: SessionStatus, event: string): boolean {
  return `${current}:${event}` in TRANSITIONS;
}

/** teaching_input is only valid in the TEACHING state (§4.2). */
export function acceptsTeachingInput(current: SessionStatus): boolean {
  return current === "TEACHING";
}
