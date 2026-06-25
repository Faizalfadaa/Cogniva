/**
 * Prompts and structured-output schema for the Learner agent (Architecture
 * Document §3.6). Kept separate from the agent logic so prompts can evolve
 * without touching the orchestration code.
 */

import type { VisionInterpretation } from "../../contracts/board.js";
import type { LearnerState } from "../../contracts/learner.js";
import type { SpeechTranscript } from "../../contracts/speech.js";

/**
 * Structured-output schema for one student turn (camelCase, structured-outputs
 * compliant: every object closed, every property required).
 */
export const LEARNER_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    response: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["question", "confusion", "acknowledgment", "paraphrase"],
        },
        text: { type: "string" },
        targetConcept: { type: "string" },
        derivedFrom: {
          type: "string",
          enum: ["gap", "misconception", "new_info"],
        },
      },
      required: ["type", "text", "targetConcept", "derivedFrom"],
    },
    understoodConcepts: { type: "array", items: { type: "string" } },
    activeMisconceptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          concept: { type: "string" },
          belief: { type: "string" },
        },
        required: ["concept", "belief"],
      },
    },
    openGaps: { type: "array", items: { type: "string" } },
  },
  required: ["response", "understoodConcepts", "activeMisconceptions", "openGaps"],
};

/** Build the student persona system prompt for a topic (§3.6). */
export function buildSystemPrompt(title: string, description: string): string {
  return `You are role-playing as a NOVICE STUDENT who is being taught about "${title}" by \
the user, who is the teacher. ${description}

Stay strictly in the student role for the entire session:
- You are a beginner. You do NOT understand the material well yet.
- NEVER teach, correct, grade, explain back authoritatively, or reveal the \
correct answer. A real beginner would not know it.
- React to what the teacher just explained by doing exactly ONE of: asking a \
naive question, expressing genuine confusion, or paraphrasing your \
(possibly flawed) understanding to check it.
- Reason from your CURRENT understanding, including any misconceptions you \
currently hold. Let those misconceptions surface naturally as plausible \
beginner beliefs or questions, so the teacher has something real to address.
- Use ONLY what the teacher has actually explained plus your current beginner \
understanding. Do not pull in outside expert knowledge to fill gaps.

After responding, update your mental model to reflect this turn: what you now \
understand, which misconceptions you still hold (or have dropped), and which \
gaps remain. Keep it realistic for a beginner — do not suddenly understand \
everything.

Reply with ONLY the JSON object required by the response schema.`;
}

/** Build the per-turn user prompt from the board reading, speech, and state. */
export function buildUserPrompt(
  interpretation: VisionInterpretation,
  speech: SpeechTranscript | null,
  state: LearnerState,
): string {
  const parts: string[] = [];
  parts.push(
    "What the teacher just put on the board / notes:\n" +
      (interpretation.transcribedText || "(nothing legible)"),
  );
  if (speech && speech.transcript) {
    parts.push("What the teacher said out loud:\n" + speech.transcript);
  }

  const understood = state.understoodConcepts.join(", ") || "(nothing yet)";
  const misconceptions =
    state.activeMisconceptions
      .map((m) => `${m.concept}: ${m.belief}`)
      .join("; ") || "(none recorded)";
  const gaps = state.openGaps.join(", ") || "(none recorded)";
  parts.push(
    "Your current mental model as the student:\n" +
      `- Concepts you feel you understand: ${understood}\n` +
      `- Misconceptions you currently hold: ${misconceptions}\n` +
      `- Gaps you're unsure about: ${gaps}`,
  );
  parts.push(
    "Respond as the student for this turn, then return your updated mental model.",
  );
  return parts.join("\n\n");
}
