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
    depthScore: { type: "integer", minimum: 0, maximum: 100 },
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
          // Not required: a MISSED concept has no turn to quote from.
          sourceQuote: { type: "string" },
          // Not required: a CORRECT finding has nothing to follow up on.
          followUp: { type: "string" },
        },
        required: ["category", "concept", "detail", "evidenceTurnIndex"],
      },
    },
  },
  required: [
    "score",
    "depthScore",
    "summary",
    "strengths",
    "improvements",
    "findings",
  ],
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

SOURCE QUOTES:
For each finding (except MISSED with no related turn), quote the EXACT sentence
or phrase (verbatim substring, not paraphrased) from that turn's board text or
speech that supports this finding, in the sourceQuote field. The quote must be
an exact substring so it can be located and highlighted in the original text --
do not summarize or rephrase it. If you cannot quote the turn word for word,
leave sourceQuote out entirely rather than approximating it.

FOLLOW-UP SUGGESTIONS:
For each finding with category WRONG, MISSED, or CONFUSING, write a short,
specific, actionable followUp suggestion (one or two sentences) telling the user
exactly what to revisit or explain better next time. Leave followUp empty for
CORRECT findings.

WRITING STYLE (applies to every text field you produce):
Do not use dashes (hyphens or em dashes) as punctuation anywhere in your output
text (summary, detail, followUp, reflection). Write in plain complete sentences
using commas or periods instead. Do not use emoji anywhere in your output.

DEPTH SCORE:
depthScore (0..100) is SEPARATE from score: it measures how deeply the user
explained WHY/HOW something works, versus just naming the right terms
correctly. A user who says "photosynthesis converts light to energy" (correct
but shallow) should score high on "score" for that concept but low on
"depthScore" compared to someone who explains the actual mechanism. Judge
depthScore across the whole session, not per finding.

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
${renderReference(input)}

# Key Concepts That Should Ideally Be Conveyed
${input.keyConcepts.length ? input.keyConcepts.map((c) => `- ${c}`).join("\n") : "(none)"}

# Common Misconceptions (watch for these in the user's explanation)
${input.commonMisconceptions.length ? input.commonMisconceptions.map((c) => `- ${c}`).join("\n") : "(none)"}

# Session Transcript (turn by turn)
${transcript}

# Task
Assess the quality of the user's explanation against the reference material.
Return JSON matching the schema: score (0..100), depthScore (0..100), summary,
strengths[], improvements[], and findings[] with category
CORRECT/WRONG/MISSED/CONFUSING, evidenceTurnIndex, a verbatim sourceQuote from
that turn wherever one exists, and a followUp suggestion on everything that is
not CORRECT.
`.trim();
}

/**
 * Render the reference section, in whichever of the two forms the caller sent.
 *
 * On the RAG path the model gets retrieved excerpts plus an outline of the whole
 * document. The outline is not decoration: excerpts are retrieved using what the
 * user said, so on their own they could never expose a concept the user never
 * mentioned — and MISSED is exactly that kind of finding. The outline restores
 * the document's full scope at a fraction of its length.
 */
function renderReference(input: EvaluatorInput): string {
  const excerpts = input.referenceExcerpts ?? [];
  if (excerpts.length === 0) {
    return `# Reference Material (source of truth)\n${input.referenceMaterial || "(empty)"}`;
  }

  const outline = input.referenceOutline ?? [];
  const outlineBlock = outline.length
    ? `# Reference Material — Outline of the FULL document
Every section of the reference, one line each. Use this to judge coverage: a
concept listed here that never appears in the transcript is a MISSED finding.
${outline.map((line) => `- ${line}`).join("\n")}

`
    : "";

  return `${outlineBlock}# Reference Material — Retrieved Excerpts (source of truth)
These are the passages of the reference most relevant to what the user taught.
They are verbatim; quote and reason from them. Passages not shown are summarised
in the outline above — do not assume they contradict the user.
${excerpts.map((excerpt) => `\n[${excerpt.label}]\n${excerpt.text}`).join("\n")}`;
}

function renderTurn(turn: EvaluatorInput["turns"][number]): string {
  const lines = [`Turn ${turn.turnIndex}:`];
  if (turn.boardText?.trim()) lines.push(`  Board/text: ${turn.boardText.trim()}`);
  if (turn.speech?.trim()) lines.push(`  Speech: ${turn.speech.trim()}`);
  if (turn.learnerUtterance?.trim())
    lines.push(`  Student reaction: ${turn.learnerUtterance.trim()}`);
  return lines.join("\n");
}
