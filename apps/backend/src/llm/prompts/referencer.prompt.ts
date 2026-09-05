/**
 * Referencer prompts — two passes, because Gemini will not run both at once.
 *
 * Attaching a grounding tool and asking for `application/json` is rejected
 * outright ("Tool use with a response mime type: 'application/json' is
 * unsupported"), so the work is split:
 *
 *   1. SEARCH  — grounded with googleSearch, plain prose. The model looks the
 *                material up instead of recalling it.
 *   2. SHAPE   — no tools, structured output. Turns pass 1's prose into JSON.
 *
 * Pass 2 is deliberately told it may not add anything: every link in the JSON has
 * to come from the text it was given. That, plus the host check in the guard, is
 * what keeps invented URLs out of the list.
 */

import { REFERENCE_KINDS } from "../../agents/referencer/referencer.types.js";
import type { SuggestReferencesArgs } from "../../agents/referencer/referencer.types.js";

/** Structured-output schema for the shaping pass (§7.3). */
export const REFERENCER_LLM_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          source: { type: "string" },
          kind: { type: "string", enum: [...REFERENCE_KINDS] },
          summary: { type: "string" },
          whyRelevant: { type: "string" },
        },
        required: ["title", "url", "source", "kind", "summary", "whyRelevant"],
      },
    },
  },
  required: ["options"],
};

const searchSystemPrompt = `
You are the REFERENCE FINDER for a 'learning by teaching' study app. A student is
about to explain a topic out loud, and their explanation will later be graded
against reference material. This student has none, so you look for some.

Use Google Search. Do not answer from memory: every source you name must be one
the search actually returned, and you must write its real URL.

What makes a good candidate, in order:
1. Freely readable — no paywall, no login, no purchase.
2. From a source that is accountable for being correct: universities, textbook
   publishers, established encyclopedias, government or museum education pages,
   well-known open-courseware sites, peer-reviewed papers.
3. About the whole topic, not one narrow corner of it. The student is explaining
   the subject, so they need coverage, not a case study.
4. Readable at the level implied by how the student described the topic.

Prefer a mix: at least one plain explanatory article, and where they exist, a
downloadable PDF (textbook chapter, lecture notes, paper) and a course page.
Skip anything you cannot see a real URL for. Skip link aggregators, SEO blogs,
content farms, and pages that are mostly advertising.

Write your answer as a short numbered list. For each candidate give, on separate
lines: the exact title, the full URL, the publisher, what it covers in one or two
sentences, and one sentence on why it fits this topic. No preamble, no closing
remarks. If the search returns nothing usable, say so plainly instead of filling
the list.
`.trim();

/** The grounded pass: system + user, sent with the googleSearch tool. */
export function buildReferenceSearchPrompt(args: SuggestReferencesArgs): {
  system: string;
  user: string;
} {
  const lines = [`Topic the student will explain: ${args.topic.trim() || "(not stated)"}`];
  if (args.description?.trim()) {
    lines.push(`How they described it: ${args.description.trim().slice(0, 600)}`);
  }
  if (args.hint?.trim()) {
    lines.push(`What they asked for: ${args.hint.trim().slice(0, 300)}`);
  }
  lines.push(
    "",
    `Find ${args.count ?? 4} candidates and list them in the format above.`,
  );

  return { system: searchSystemPrompt, user: lines.join("\n") };
}

const shapeSystemPrompt = `
You convert a reference list that has already been written into JSON. You are a
formatter, not a researcher.

Rules:
- Use ONLY the sources present in the text you are given. Do not add sources, do
  not complete a partial URL, do not correct one you think is wrong, and do not
  substitute a link you happen to know.
- Copy each URL exactly, character for character.
- If the text names fewer sources than expected, return fewer. An empty list is a
  valid answer when the text names none.
- kind: "pdf" for a downloadable document, "course" for a course or lecture page,
  "video" for a video, "book" for a full book, "article" for anything else.
- Write summary and whyRelevant in Indonesian, one or two sentences each, using
  what the text says. Keep titles and publisher names in their original language.
`.trim();

/** The shaping pass: no tools, structured output over the grounded prose. */
export function buildReferenceShapePrompt(prose: string): { system: string; user: string } {
  return {
    system: shapeSystemPrompt,
    user: `Reference list to convert:\n\n${prose}\n\nOutput JSON matching the schema.`,
  };
}

const readSystemPrompt = `
You build study notes from a web page. The notes become the marking key an
automated grader checks a student's spoken explanation against.

Read the page you are given and write structured notes covering everything it
teaches: one heading per section of the page, and under each heading the facts
that section establishes — definitions, terms, formulas, numbers, causes, steps,
named entities, and how they relate.

Write the facts in your own words. Do not copy sentences or paragraphs from the
page. Terms, formulas, symbols, units and numbers ARE copied exactly, because
rewording those would change the fact the grader checks. Cover the whole page,
not the parts you find most interesting, and add nothing the page does not say.
Write in Indonesian, keeping technical terms in their original form.

Skip navigation, menus, adverts, comments and "related articles" lists. If the
page cannot be read, is empty, or turns out to be a search results page rather
than an article, reply with exactly: UNREADABLE
`.trim();

/** The URL-context pass: turns a chosen source into reference text. */
export function buildReferenceReadPrompt(url: string, topic: string): {
  system: string;
  user: string;
} {
  return {
    system: readSystemPrompt,
    user: `Read ${url} and write the notes. Topic being studied: ${topic || "(unspecified)"}.`,
  };
}
