import type { AIMessage } from "./learner.prompt.js";
import { feasibleSteps } from "../../agents/planner/planner.guard.js";
import { PLAN_STEP_KINDS, type TurnSituation } from "../../agents/planner/planner.types.js";

/**
 * The Planner's structured-output schema, attached to Gemini via
 * responseJsonSchema (§7.3) — same mechanism as the other agents, so the model
 * is forced to emit step names from the enum rather than inventing its own.
 */
export const PLANNER_LLM_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: [...PLAN_STEP_KINDS] },
          reason: { type: "string" },
          focus: { type: "string" },
        },
        required: ["kind", "reason", "focus"],
      },
    },
    rationale: { type: "string" },
  },
  required: ["steps", "rationale"],
};

/**
 * Planner system prompt (§S5). The model is a scheduler, not a teacher: it never
 * sees the reference material and never writes the student's words, it only
 * decides which of the four agents runs next and in what order. The hard rules
 * below mirror the guard — anything the model gets wrong is corrected there, but
 * stating them keeps most plans correct on the first try.
 */
const plannerSystemPrompt = `
You are the PLANNER for a 'learning by teaching' study app. Four workers exist:
Vision (reads the whiteboard), ASR (transcribes the voice clip), the Learner (an
AI student who reacts to the explanation), and the user (who can be asked to
confirm an unclear board reading).

Your ONLY job is to decide the ORDER OF WORK for one teaching turn, given the
state of that turn. You do not teach, you do not read the board yourself, and you
never write the student's reply.

The steps you may schedule:
- read_board       run Vision over this turn's board image
- reuse_board      the board did not change since the previous turn: carry that
                   reading over and skip Vision entirely
- verify_board     a second, directed Vision pass over a low-confidence reading;
                   put the unclear part in 'focus'
- transcribe_audio run ASR over this turn's audio clip
- ask_learner      TERMINAL: hand everything to the student
- ask_confirmation TERMINAL: pause and ask the user to correct the board reading

HARD RULES:
1. The plan must end with exactly one terminal step, and nothing after it.
2. Never schedule a step whose input is missing: no audio means no
   transcribe_audio, no previous board means no reuse_board, and
   ask_confirmation is only allowed when the situation says confirmation is
   available.
3. Each step at most once per turn.
4. Cheapest plan that still does the job. Every step is a model call: skipping
   Vision on an unchanged board, or skipping ASR when there is no clip, is the
   whole point of planning.
5. Only re-read the board (verify_board) when the reading is genuinely unsure.
   A confident reading goes straight on.
6. Prefer verify_board over ask_confirmation: interrupt the user only when
   looking again did not help.
7. Reply with ONLY valid JSON matching the given schema. 'focus' may be an empty
   string for steps that do not need it.
`;

export function buildPlannerMessages(situation: TurnSituation): AIMessage[] {
  return [
    { role: "system", content: plannerSystemPrompt },
    { role: "user", content: buildPlannerUserPrompt(situation) },
  ];
}

function buildPlannerUserPrompt(situation: TurnSituation): string {
  const yes = (value: boolean): string => (value ? "yes" : "no");
  const num = (value: number | null): string =>
    value === null ? "not measured yet" : value.toFixed(2);

  const lines = [
    `Turn index: ${situation.turnIndex}`,
    "",
    "What the user sent this turn:",
    `- board image: ${yes(situation.hasImage)}`,
    `- audio clip: ${yes(situation.hasAudio)}`,
    `- typed text (fallback channel): ${yes(situation.hasTypedText)}`,
    "",
    "Carried over from earlier turns:",
    `- a previous board reading exists: ${yes(situation.hasPreviousBoard)}`,
    `- the board is unchanged since then: ${yes(situation.boardUnchanged)}`,
    "",
    "Already done this turn:",
    `- steps: ${situation.completed.length ? situation.completed.join(", ") : "(none yet)"}`,
    `- board read: ${yes(situation.boardRead)} (confidence ${num(situation.boardConfidence)}, unsure: ${yes(situation.boardNeedsConfirmation)})`,
    `- audio transcribed: ${yes(situation.audioTranscribed)} (confidence ${num(situation.speechConfidence)})`,
  ];

  if (situation.boardText) {
    lines.push(`- board says: "${situation.boardText.slice(0, 400)}"`);
  }
  if (situation.boardClarification) {
    lines.push(`- Vision is unsure about: "${situation.boardClarification.slice(0, 200)}"`);
  }

  lines.push(
    "",
    "Constraints:",
    `- asking the user to confirm is available: ${yes(situation.allowConfirmation)}`,
    `- steps left in this turn's budget: ${situation.stepsLeft}`,
    `- steps that can run right now: ${feasibleSteps(situation).join(", ") || "(none)"}`,
    "",
    "Plan the remaining steps of this turn, then output JSON matching the schema.",
  );

  return lines.join("\n");
}
