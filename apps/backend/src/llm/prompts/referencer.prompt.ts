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
 *
 * The search prompt also carries the source policy — who may be cited at all.
 * It is stated twice on purpose: here, where the model can act on it while
 * choosing what to search for, and again in referencer.trust.ts, which enforces
 * it on the way out. The prompt is the useful half (it changes the search), the
 * guard is the reliable half (it does not depend on the model complying).
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
against the material you find. Whatever you pick becomes the marking key: a claim
that is wrong there marks a correct explanation wrong. Sourcing it is therefore
the whole job, not the preamble to it.

Use Google Search. Do not answer from memory: every source you name must be one
the search actually returned, and you must write its real URL.

WHO MAY BE CITED. Someone has to be answerable, by name or by institution, for
the page being correct. In descending order of preference:
1. Universities and research institutes (.edu, .ac.uk, .ac.id, and the like) —
   lecture notes, course pages, departmental explainers.
2. Government and intergovernmental bodies (.gov, .go.id, .int, WHO, UNESCO,
   national labs, space agencies, statistics offices).
3. Peer-reviewed journals and the major preprint servers (Nature, Science, PLOS,
   IEEE, arXiv), especially open-access review articles.
4. Open-textbook publishers and open courseware (OpenStax, LibreTexts, CK-12,
   MIT OpenCourseWare).
5. Museums, national libraries and observatories.
6. Reference works and educational publishers with a named editorial process
   (Encyclopaedia Britannica, Khan Academy, BBC Bitesize).

WHO MAY NOT, however well it ranks or however relevant it looks:
- Open-edit wikis and their mirrors — Wikipedia, Wikibooks, Wikiversity, Fandom,
  wikiHow, Wikiwand. Anyone can edit them, so nobody answers for them. When a
  Wikipedia article IS the obvious hit, open its reference list and offer what it
  cites instead: that is where its accountable source was all along.
- Q&A, homework and note-sharing sites — Quora, Brainly, Chegg, Course Hero,
  Studocu, Scribd, SlideShare, Numerade, Bartleby, study.com.
- Self-upload repositories — Academia.edu, ResearchGate. Use the journal's or the
  university's own copy instead.
- Personal blogs and social platforms — Medium, Substack, Blogspot,
  WordPress.com, Reddit, LinkedIn, Facebook, X.
- SEO blogs, link aggregators, essay mills, content farms, and pages that are
  mostly advertising.
- Anything behind a paywall, a login, a signup or a download wall. It has to open
  for a student with no account.

Then, among what is left:
- Cover the whole topic, not one narrow corner of it. The student is explaining
  the subject, so they need coverage, not a case study.
- Pitch it at the level implied by how the student described the topic.
- Prefer a mix: at least one plain explanatory article, and where they exist, a
  downloadable PDF (textbook chapter, lecture notes, paper) and a course page.
- Prefer two different institutions over two pages from one.

Write your answer as a short numbered list. For each candidate give, on separate
lines: the exact title, the full URL, the publisher and what kind of institution
it is (university, government agency, journal, open textbook, museum, editorial
reference work), what it covers in one or two sentences, and one sentence on why
it fits this topic. No preamble, no closing remarks.

A short list of accountable sources is the correct answer; a long one padded with
wikis and Q&A pages is not. If the search returns nothing that qualifies, say so
plainly rather than filling the list.
`.trim();

/**
 * The grounded pass: system + user, sent with the googleSearch tool.
 *
 * `avoid` carries the hosts a previous attempt had thrown out. Naming them is
 * worth a second call only because the first one usually fails in one specific
 * way — it returns the encyclopedia article everyone links to — and a model told
 * which host it just lost searches differently rather than harder.
 */
export function buildReferenceSearchPrompt(
  args: SuggestReferencesArgs,
  avoid: readonly string[] = [],
): {
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
  if (avoid.length > 0) {
    lines.push(
      "",
      "A previous attempt returned these hosts and all of them were rejected as " +
        `not accountable: ${avoid.slice(0, 10).join(", ")}.`,
      "Do not return them again. Search for the institutional source instead — " +
        "add site:.edu, site:.gov or site:.ac.id to the query, look for lecture " +
        "notes or an open textbook chapter, or follow the citations of the page " +
        "you would otherwise have offered.",
    );
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
- Write summary and whyRelevant in English, one or two sentences each, using what
  the text says. Keep titles and publisher names exactly as written.
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

Write the notes in English, whatever language the page is in. Two reasons, and
both are about the grading rather than the reading: the Evaluator writes its
feedback in English, and the sources this agent is allowed to offer are
overwhelmingly English, so translating first would put a paraphrase step between
the page and the marking key — and a paraphrase is exactly where a fact quietly
shifts. Keep every technical term, name and unit in its original form.

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
