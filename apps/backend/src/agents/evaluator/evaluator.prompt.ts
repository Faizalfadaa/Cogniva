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
    // No `score`. It is computed from `findings` in scoring.ts, so asking the
    // model for one would produce a number nothing reads and invite it to
    // reason backwards from a total it had already decided on.
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

HOW TO CHOOSE A CATEGORY (apply these tests in order):
1. Was the concept absent from the transcript entirely? -> MISSED. Say MISSED
   only for a concept the reference material treats as important. Do not invent
   gaps for material the reference never covers.
2. Did the user state something that contradicts the reference material, or
   match one of the listed common misconceptions? -> WRONG. Being incomplete is
   not WRONG. Reserve WRONG for something a student would have to unlearn.
3. Is the statement accurate but ambiguous, out of order, or open to being read
   the wrong way? -> CONFUSING. Judge this on the words in the transcript, not
   on how much detail is missing. Shallow but clear is CORRECT, not CONFUSING.
4. Otherwise -> CORRECT.

One finding per concept. Do not emit two findings for the same concept, and do
not split one concept into several findings to make a session look worse or
better than it was.

RULES:
- Assess only based on the given transcript and reference material.
- Cite evidenceTurnIndex from the transcript for each finding. For a MISSED item
  with no related turn, use evidenceTurnIndex 0.
- Do NOT return an overall score. The app computes it from your findings, so
  your job is to classify each concept correctly, not to grade the session.
- Write "summary", "strengths", "improvements", and "detail" in clear,
  constructive English.

SOURCE QUOTES:
For each finding (except MISSED with no related turn), quote the EXACT sentence
or phrase (verbatim substring, not paraphrased) from that turn's board text,
speech, or "Teacher (chat)" line that supports this finding, in the sourceQuote
field. The quote must be an exact substring so it can be located and highlighted
in the original text -- do not summarize or rephrase it. If you cannot quote the
turn word for word, leave sourceQuote out entirely rather than approximating it.

Never quote a "Student (chat)" line. Those are the student's words, not the
teacher's, and a finding is a judgement of what the teacher taught.

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
depthScore (0..100) is the ONE number you return, and it is not a grade for the
session. It measures a single thing: how far the user went past naming terms
into explaining WHY and HOW something works. Judge it across the whole session,
not per finding, and pick the band the session mostly sits in:

  0-20   Names terms only. "Photosynthesis makes glucose." No process at all.
  21-40  States what happens, but not what causes it. Steps are listed as facts
         side by side, with nothing connecting one to the next.
  41-60  One causal link is explained. "Chlorophyll absorbs light, and that
         energy splits water." The chain stops after a step or two.
  61-80  A full mechanism, end to end, with the steps in the right order and
         each one following from the last.
  81-100 The mechanism plus why it has to work that way: what the constraint
         is, what would break if a step were missing, or why an alternative
         does not work.

Pick the band from what the transcript actually contains. Do not raise it
because the user sounded confident, and do not lower it because a concept was
missed. A short session that explains one mechanism properly belongs in 61-80.

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
A turn can carry four channels: what was written on the board, what was said
aloud over it, how the student reacted, and the chat that followed. A
"Teacher (chat)" line is teaching just as much as the board is -- often the
sharpest teaching in the session, because it answers a confusion the student
had just named. Judge a concept as MISSED only when it appears in none of them.
${transcript}

# Task
Assess the quality of the user's explanation against the reference material.
Return JSON matching the schema: depthScore (0..100, using the bands above),
summary, strengths[], improvements[], and findings[] with category
CORRECT/WRONG/MISSED/CONFUSING, evidenceTurnIndex, a verbatim sourceQuote from
that turn wherever one exists, and a followUp suggestion on everything that is
not CORRECT. Do not return an overall score.
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
  // Labelled by speaker, because who said a thing decides what it means: the
  // same sentence is an explanation from the teacher and a guess from the
  // student. "Teacher" rather than "user" so the model reads the transcript as
  // a lesson rather than as an app session.
  for (const message of turn.chat ?? []) {
    if (!message.text?.trim()) continue;
    const who = message.sender === "user" ? "Teacher (chat)" : "Student (chat)";
    lines.push(`  ${who}: ${message.text.trim()}`);
  }
  return lines.join("\n");
}
