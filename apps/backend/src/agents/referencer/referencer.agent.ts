/**
 * Referencer agent — finds reading material when the user brought none.
 *
 * Two model calls, because Gemini refuses to run a grounding tool and structured
 * output in the same request ("Tool use with a response mime type:
 * 'application/json' is unsupported"):
 *
 *   1. grounded({ mode: "search" })  -> prose list, plus the sources Google
 *                                       Search actually returned;
 *   2. structured()                  -> that prose as JSON, no tools attached.
 *
 * Materializing a chosen option is a third, separate call —
 * grounded({ mode: "url" }) — made only when the user picks something, so the
 * expensive fetch is paid for one source rather than four. When that call comes
 * back empty, referencer.fetch.ts downloads the page directly; see its header
 * for why that fallback is not optional.
 *
 * Every candidate then goes through the source policy in referencer.trust.ts
 * before it is offered. What this agent produces is the Evaluator's marking key,
 * so a page nobody is answerable for does not merely mislead the student — it
 * marks a correct explanation wrong. Open-edit wikis, Q&A sites and note dumps
 * are dropped there rather than ranked down, which is why a thin list can be a
 * correct one, and why the search is allowed one retry that names the hosts it
 * just lost.
 *
 * Offline behavior matches every other agent: no credential, USE_MOCK_AI, or a
 * failed call all land on the deterministic list rather than an error. Nothing
 * here throws.
 */

import * as config from "../../config/index.js";
import { LLMClient, type GroundedSource } from "../../llm/index.js";
import {
  buildReferenceReadPrompt,
  buildReferenceSearchPrompt,
  buildReferenceShapePrompt,
  REFERENCER_LLM_OUTPUT_SCHEMA,
} from "../../llm/prompts/referencer.prompt.js";
import { fetchSourceText } from "./referencer.fetch.js";
import {
  normalizeFetchedText,
  normalizeOptions,
  optionsFromSources,
  type GuardedOptions,
} from "./referencer.guard.js";
import { suggestOffline } from "./referencer.mock.js";
import type {
  FetchedReference,
  ReferenceSuggestions,
  ReferencerLLMOutput,
  SuggestReferencesArgs,
} from "./referencer.types.js";

/** The model's way of saying the page was not usable (see the read prompt). */
const UNREADABLE = "UNREADABLE";

const THIN_RESULT_NOTICE =
  "The search found only a few usable sources. If none of them fit, you can still upload " +
  "a PDF of your own.";

const UNVERIFIED_NOTICE =
  "Some of the links below were not confirmed to appear in the search results — open them " +
  "and check before using one.";

const REJECTED_NOTICE =
  "Some results were skipped because nobody is answerable for what they say — open-edit " +
  "wikis such as Wikipedia, Q&A sites, and personal uploads. This material becomes the " +
  "marking key for your explanation, so its source has to be accountable.";

function client(maxTokens: number = config.REFERENCER_MAX_TOKENS): LLMClient {
  return new LLMClient({
    model: config.REFERENCER_MODEL,
    maxTokens,
    timeout: config.LLM_TIMEOUT,
    thinkingBudget: config.LLM_THINKING_BUDGET,
  });
}

/** Suggest reading material for a topic. Never throws. */
export async function suggestReferences(
  args: SuggestReferencesArgs,
): Promise<ReferenceSuggestions> {
  const count = Math.max(1, args.count ?? config.REFERENCER_OPTIONS);
  const request = { ...args, count };

  const useMock =
    request.useMock === true || process.env.USE_MOCK_AI === "true" || !config.llmAvailable();
  if (useMock) return suggestOffline(request);

  try {
    return await searchForReferences(request);
  } catch (error) {
    console.error("[ReferencerAgent] Failed to find references:", error);
    return suggestOffline(request);
  }
}

/**
 * The grounded search + shaping pair, plus at most one retry.
 *
 * The retry exists because of how this search fails in practice. It does not
 * come back empty — it comes back with the encyclopedia article every search for
 * a school topic surfaces first, which the source policy then removes, leaving a
 * list too short to choose from. Telling the model which hosts it just lost and
 * asking again is the cheapest way out of that, and it is skipped entirely when
 * the first pass already produced enough. Costing a second call on every request
 * to guard against an uncommon case would be the wrong trade.
 */
async function searchForReferences(args: SuggestReferencesArgs): Promise<ReferenceSuggestions> {
  const topic = args.topic.trim();
  const limit = args.count ?? config.REFERENCER_OPTIONS;

  let { options, rejected } = await runSearch(args, limit);

  if (options.length < Math.min(2, limit) && rejected.length > 0) {
    const retry = await runSearch(args, limit, rejected);
    if (retry.options.length > options.length) {
      options = retry.options;
      rejected = [...new Set([...rejected, ...retry.rejected])];
    }
  }

  // Nothing survived: a genuine miss, and the offline libraries are a more
  // useful answer than an empty list.
  if (options.length === 0) {
    const offline = suggestOffline(args);
    return rejected.length > 0
      ? {
          ...offline,
          notice: `${REJECTED_NOTICE} ${offline.notice}`,
          noticeCodes: ["rejected", ...(offline.noticeCodes ?? [])],
        }
      : offline;
  }

  // The English sentences stay for API clients and logs; the codes let the
  // interface show the same notices in the reader's language.
  const notices: string[] = [];
  const noticeCodes: NonNullable<ReferenceSuggestions["noticeCodes"]> = [];
  if (options.length < Math.min(2, limit)) {
    notices.push(THIN_RESULT_NOTICE);
    noticeCodes.push("thin");
  }
  // Worth saying only when it explains something the user can see — a list that
  // came back shorter than they asked for.
  if (rejected.length > 0 && options.length < limit) {
    notices.push(REJECTED_NOTICE);
    noticeCodes.push("rejected");
  }
  if (options.some((option) => !option.verified)) {
    notices.push(UNVERIFIED_NOTICE);
    noticeCodes.push("unverified");
  }

  return { topic, options, source: "search", notice: notices.join(" "), noticeCodes };
}

/** One grounded search, shaped and filtered. `avoid` is passed on to the prompt. */
async function runSearch(
  args: SuggestReferencesArgs,
  limit: number,
  avoid: readonly string[] = [],
): Promise<GuardedOptions> {
  const search = buildReferenceSearchPrompt(args, avoid);
  const searcher = client();
  const found = await searcher.grounded({ ...search, mode: "search" });
  if (args.onUsage && searcher.lastUsage) args.onUsage(searcher.lastUsage);

  const shaped = await shapeIntoOptions(found.text, found.sources, limit, args.onUsage);
  if (shaped.options.length > 0) return shaped;

  // The shaping pass produced nothing usable, but the search itself did find
  // pages. Offer those rather than pretending the search failed — and keep the
  // hosts it rejected, since the retry above is steered by them.
  const direct = optionsFromSources(found.sources, limit);
  return {
    options: direct.options,
    rejected: [...new Set([...shaped.rejected, ...direct.rejected])],
  };
}

/** Second pass: prose -> JSON, with no tools attached so structured output works. */
async function shapeIntoOptions(
  prose: string,
  sources: GroundedSource[],
  limit: number,
  onUsage: SuggestReferencesArgs["onUsage"],
): Promise<GuardedOptions> {
  if (!prose.trim()) return { options: [], rejected: [] };
  try {
    const shaper = client();
    const data = await shaper.structured({
      ...buildReferenceShapePrompt(prose),
      schema: REFERENCER_LLM_OUTPUT_SCHEMA,
    });
    if (onUsage && shaper.lastUsage) onUsage(shaper.lastUsage);
    const guarded = normalizeOptions(data as unknown as ReferencerLLMOutput, sources, limit);
    if (guarded.rejected.length > 0) {
      console.warn(
        "[ReferencerAgent] Dropped sources with no accountable publisher:",
        guarded.rejected.join(", "),
      );
    }
    return guarded;
  } catch (error) {
    // Non-fatal: the caller falls back to the grounded sources themselves.
    console.error("[ReferencerAgent] Failed to shape search results:", error);
    return { options: [], rejected: [] };
  }
}

/** Below this, what came back is a stub or an error page, not study material. */
const MIN_REFERENCE_CHARS = 400;

/**
 * Read a chosen source and return its text, ready to become the session's
 * reference material.
 *
 * Two attempts, in quality order. The model's notes come first because they are
 * clean and already organized by heading. When the model returns nothing — which
 * it does for any page that renders through JavaScript, and for many hosts that
 * refuse its fetcher — the server downloads the page itself and extracts the
 * text. That second pass is noisier, but it is the difference between a list of
 * options that works and one that mostly does not.
 *
 * Never throws: a source that cannot be read either way is a normal outcome, and
 * the caller shows the problem and lets the user choose again.
 */
export async function fetchReferenceText(
  url: string,
  topic: string,
  options: { useMock?: boolean; onUsage?: SuggestReferencesArgs["onUsage"] } = {},
): Promise<FetchedReference> {
  const base: FetchedReference = { url, title: "", text: "", ok: false, problem: "" };

  const useMock =
    options.useMock === true || process.env.USE_MOCK_AI === "true" || !config.llmAvailable();

  // Offline the notes pass is unavailable, but the direct download is not — it
  // needs no credential at all. So the fallback becomes the only path rather
  // than the second one, and the feature still works with no API key.
  if (!useMock) {
    const notes = await readAsNotes(url, topic, options.onUsage);
    if (notes) return { url, title: firstLine(notes), text: notes, ok: true, problem: "" };
  }

  const direct = await fetchSourceText(url);
  const text = normalizeFetchedText(direct.text, config.REFERENCER_MAX_FETCH_CHARS);
  if (text.length >= MIN_REFERENCE_CHARS) {
    return { url, title: firstLine(text), text, ok: true, problem: "" };
  }

  // Prefer the download's own diagnosis (a 403, a timeout) over a generic line:
  // it tells the user whether another option would fare better.
  return {
    ...base,
    problem:
      direct.problem ||
      "That page does not hold enough text to use as reference material. Try another option.",
  };
}

/** The model's notes pass. Returns "" for every failure, so the caller retries. */
async function readAsNotes(
  url: string,
  topic: string,
  onUsage: SuggestReferencesArgs["onUsage"],
): Promise<string> {
  try {
    const reader = client(config.REFERENCER_READ_MAX_TOKENS);
    const result = await reader.grounded({
      ...buildReferenceReadPrompt(url, topic),
      mode: "url",
    });
    if (onUsage && reader.lastUsage) onUsage(reader.lastUsage);

    // urlContext reports per-URL retrieval status, so a fetch that failed
    // outright is detectable rather than inferred from the prose.
    if (result.retrieved.some((entry) => !entry.ok)) return "";

    const text = normalizeFetchedText(result.text, config.REFERENCER_MAX_FETCH_CHARS);
    // Two ways of saying the same thing: the model said UNREADABLE, or it
    // returned nothing at all — which is what a JavaScript-only page produces
    // despite a "success" retrieval status.
    if (!text || text.toUpperCase().startsWith(UNREADABLE)) return "";
    return text.length >= MIN_REFERENCE_CHARS ? text : "";
  } catch (error) {
    // Includes the "no text content" case, where Gemini returns an empty
    // candidate for a page it declines to write about.
    console.error("[ReferencerAgent] Notes pass failed, falling back to direct fetch:", error);
    return "";
  }
}

/**
 * The notes usually open with a heading, but not always — sometimes line one is
 * the first paragraph, and a truncated paragraph makes a terrible title. So it
 * is used only when it actually reads like a heading; otherwise the caller falls
 * back to the title the user picked from the option list.
 */
function firstLine(text: string): string {
  const line = text.split("\n", 1)[0]?.replace(/^#+\s*/, "").replace(/\*+/g, "").trim() ?? "";
  return line.length > 0 && line.length <= 90 && !line.endsWith(".") ? line : "";
}
