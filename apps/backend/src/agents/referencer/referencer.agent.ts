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
import { normalizeFetchedText, normalizeOptions, optionsFromSources } from "./referencer.guard.js";
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
  "Pencarian hanya menemukan sedikit sumber yang bisa dipakai. Kalau tidak ada yang cocok, " +
  "kamu masih bisa mengunggah PDF sendiri.";

const UNVERIFIED_NOTICE =
  "Sebagian tautan di bawah belum terkonfirmasi muncul di hasil pencarian — periksa dulu " +
  "sebelum dipakai.";

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

/** The grounded search + shaping pair. */
async function searchForReferences(args: SuggestReferencesArgs): Promise<ReferenceSuggestions> {
  const topic = args.topic.trim();
  const limit = args.count ?? config.REFERENCER_OPTIONS;

  const search = buildReferenceSearchPrompt(args);
  const searcher = client();
  const found = await searcher.grounded({ ...search, mode: "search" });
  if (args.onUsage && searcher.lastUsage) args.onUsage(searcher.lastUsage);

  let options = await shapeIntoOptions(found.text, found.sources, limit, args.onUsage);

  // The shaping pass produced nothing usable, but the search itself did find
  // pages. Offer those rather than pretending the search failed.
  if (options.length === 0) options = optionsFromSources(found.sources, limit);

  // Still nothing: this is a genuine miss, and the offline libraries are a more
  // useful answer than an empty list.
  if (options.length === 0) return suggestOffline(args);

  const notice =
    options.length < Math.min(2, limit)
      ? THIN_RESULT_NOTICE
      : options.some((option) => !option.verified)
        ? UNVERIFIED_NOTICE
        : "";

  return { topic, options, source: "search", notice };
}

/** Second pass: prose -> JSON, with no tools attached so structured output works. */
async function shapeIntoOptions(
  prose: string,
  sources: GroundedSource[],
  limit: number,
  onUsage: SuggestReferencesArgs["onUsage"],
): Promise<ReferenceSuggestions["options"]> {
  if (!prose.trim()) return [];
  try {
    const shaper = client();
    const data = await shaper.structured({
      ...buildReferenceShapePrompt(prose),
      schema: REFERENCER_LLM_OUTPUT_SCHEMA,
    });
    if (onUsage && shaper.lastUsage) onUsage(shaper.lastUsage);
    return normalizeOptions(data as unknown as ReferencerLLMOutput, sources, limit);
  } catch (error) {
    // Non-fatal: the caller falls back to the grounded sources themselves.
    console.error("[ReferencerAgent] Failed to shape search results:", error);
    return [];
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
      "Halaman itu tidak berisi teks yang cukup untuk dipakai sebagai referensi. Coba opsi lain.",
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
