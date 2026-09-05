/**
 * The deterministic Planner — the rule engine behind the model.
 *
 * It plays three roles at once, which is why it is more than the usual stand-in
 * mock: it is the offline planner when no API key is configured, the fallback
 * when the model call fails, and the safety net the guard uses whenever the
 * model proposes a step that does not fit the current situation. Because of that
 * last role it must always terminate: `decideStep` returns a terminal step as
 * soon as no useful preparation is left.
 *
 * The rules encode the decisions the old hardcoded pipeline could not make:
 * unchanged board -> skip Vision, no audio -> skip ASR, unsure reading -> look
 * again before bothering the user.
 */

import {
  isTerminal,
  type Plan,
  type PlanStep,
  type PlanStepKind,
  type TurnSituation,
} from "./planner.types.js";

function step(kind: PlanStepKind, reason: string, focus?: string): PlanStep {
  return focus ? { kind, reason, focus } : { kind, reason };
}

/**
 * Choose the single next step for `situation`. Pure and total: every situation
 * maps to exactly one step, and repeated application always reaches a terminal
 * step because each non-terminal step it can pick removes its own precondition.
 */
export function decideStep(situation: TurnSituation): PlanStep {
  // 1. The board comes first — everything downstream reacts to what it says.
  if (!situation.boardRead) {
    if (situation.hasPreviousBoard && situation.boardUnchanged) {
      return step(
        "reuse_board",
        "board unchanged since the previous turn — carry the reading over instead of paying for Vision",
      );
    }
    return step("read_board", "the board has not been read yet this turn");
  }

  // 2. An unsure reading is worth a second, directed look before we either
  //    interrupt the user or let the student react to a guess (§K1).
  if (situation.boardNeedsConfirmation) {
    if (situation.hasImage && !situation.completed.includes("verify_board")) {
      return step(
        "verify_board",
        "board reading came back low-confidence — re-read it before giving up",
        situation.boardClarification || situation.boardText.slice(0, 120),
      );
    }
    if (situation.allowConfirmation) {
      return step(
        "ask_confirmation",
        "still unsure after re-reading — ask the user to confirm or correct it",
      );
    }
    // No confirmation UI on this path: fall through and proceed on the best guess.
  }

  // 3. The voice channel is optional; transcribe only when a clip actually came in.
  if (
    situation.hasAudio &&
    !situation.audioTranscribed &&
    !situation.completed.includes("transcribe_audio")
  ) {
    return step("transcribe_audio", "an audio clip arrived and has not been transcribed");
  }

  // 4. Nothing left to prepare — the student reacts.
  return step("ask_learner", "input is complete — hand the turn to the student");
}

/**
 * Optimistic projection of what a step changes, used only to draft a multi-step
 * plan up front. The Orchestrator never trusts it: it rebuilds the real
 * situation after every executed step, and re-plans when reality disagrees.
 */
function projectStep(situation: TurnSituation, chosen: PlanStep): TurnSituation {
  const next: TurnSituation = {
    ...situation,
    completed: [...situation.completed, chosen.kind],
    stepsLeft: Math.max(0, situation.stepsLeft - 1),
  };
  switch (chosen.kind) {
    case "read_board":
    case "reuse_board":
      next.boardRead = true;
      // Assume the read succeeds; a low-confidence result triggers a re-plan.
      next.boardNeedsConfirmation = false;
      break;
    case "verify_board":
      next.boardNeedsConfirmation = false;
      break;
    case "transcribe_audio":
      next.audioTranscribed = true;
      break;
    default:
      break;
  }
  return next;
}

/** Draft a whole plan by applying the rules forward over the step budget. */
export function planWithRules(situation: TurnSituation): Plan {
  const steps: PlanStep[] = [];
  let current = situation;

  for (let i = 0; i < Math.max(1, situation.stepsLeft); i++) {
    const chosen = decideStep(current);
    steps.push(chosen);
    if (isTerminal(chosen.kind)) break;
    current = projectStep(current, chosen);
  }

  return {
    steps,
    source: "rules",
    rationale: "deterministic plan from the turn's inputs and the board reading so far",
  };
}
