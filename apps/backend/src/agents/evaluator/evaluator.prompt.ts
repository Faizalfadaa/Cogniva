/**
 * Evaluator prompt + structured-output schema (Architecture Document §3.7, §7.3).
 *
 * The Evaluator grades the QUALITY OF THE USER'S EXPLANATION (not the AI) against
 * the topic's reference material, turn by turn (§3.7). Categories are the
 * canonical English enum; the natural-language fields (summary, detail,
 * strengths, improvements) are written in English and rendered directly on the
 * debrief screen.
 */

import type { EvaluatorInput } from "./types.js";

export type AIMessage = { role: "system" | "user"; content: string };

/**
 * Structured-output schema for the Evaluator's JSON. Passed to the Gemini
 * wrapper (responseJsonSchema) so the model is constrained to a parseable shape.
 */
export const EVALUATOR_LLM_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: ["CORRECT", "WRONG", "MISSED", "CONFUSING"],
          },
          concept: { type: "string" },
          detail: { type: "string" },
          evidenceTurnIndex: { type: "integer" },
        },
        required: ["category", "concept", "detail", "evidenceTurnIndex"],
      },
    },
  },
  required: ["score", "summary", "strengths", "improvements", "findings"],
};

const evaluatorSystemPrompt = `
You are the Evaluator in the Cogniva app.

CONTEXT:
Cogniva uses the "learning by teaching" principle. The user has just TAUGHT a
topic to a beginner AI student. Your job is to assess the QUALITY OF THE USER'S
EXPLANATION -- not to assess the AI student -- by comparing it against the
official reference material.

WHAT TO ASSESS:
- How correct and complete the user's explanation is versus the reference material.
- Which key concepts were conveyed, which were wrong, which were missed, and which
  parts were confusing.

FINDING CATEGORIES (use EXACTLY one of these values, in uppercase):
- CORRECT  : the user explained a concept correctly.
- WRONG    : the user stated something incorrect or a misconception.
- MISSED   : an important key concept that was never mentioned at all.
- CONFUSING: the user's explanation was ambiguous, muddled, or confusing.

RULES:
- Assess only based on the given transcript and reference material.
- Cite evidenceTurnIndex from the transcript for each finding. For a MISSED item
  with no related turn, use evidenceTurnIndex 0.
- "score" is an integer 0..100 reflecting the overall quality.
- Write "summary", "strengths", "improvements", and "detail" in clear,
  constructive English.

OUTPUT:
- Reply with ONLY valid JSON matching the schema. No markdown, no code fences.
`.trim();

export function buildEvaluatorMessages(input: EvaluatorInput): AIMessage[] {
  return [
    { role: "system", content: evaluatorSystemPrompt },
    { role: "user", content: buildEvaluatorUserPrompt(input) },
  ];
}

function buildEvaluatorUserPrompt(input: EvaluatorInput): string {
  const transcript = input.turns.length
    ? input.turns.map(renderTurn).join("\n\n")
    : "(No teaching turns were recorded.)";

  return `
# Reference Material (source of truth)
${input.referenceMaterial || "(empty)"}

# Key Concepts That Should Ideally Be Conveyed
${input.keyConcepts.length ? input.keyConcepts.map((c) => `- ${c}`).join("\n") : "(none)"}

# Common Misconceptions (watch for these in the user's explanation)
${input.commonMisconceptions.length ? input.commonMisconceptions.map((c) => `- ${c}`).join("\n") : "(none)"}

# Session Transcript (turn by turn)
${transcript}

# Task
Assess the quality of the user's explanation against the reference material.
Return JSON matching the schema: score (0..100), summary, strengths[],
improvements[], and findings[] with category CORRECT/WRONG/MISSED/CONFUSING plus
evidenceTurnIndex.
`.trim();
}

function renderTurn(turn: EvaluatorInput["turns"][number]): string {
  const lines = [`Turn ${turn.turnIndex}:`];
  if (turn.boardText?.trim()) lines.push(`  Board/text: ${turn.boardText.trim()}`);
  if (turn.speech?.trim()) lines.push(`  Speech: ${turn.speech.trim()}`);
  if (turn.learnerUtterance?.trim())
    lines.push(`  Student reaction: ${turn.learnerUtterance.trim()}`);
  return lines.join("\n");
}
