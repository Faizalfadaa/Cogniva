/**
 * Guard for the Referencer — model output is untrusted (see CLAUDE.md).
 *
 * The specific risk here is not a malformed shape, it is a *convincing* one: a
 * model writing a reference list will happily produce a well-formed entry whose
 * URL was never returned by any search. So this guard does two jobs:
 *
 *   1. the usual coercion — types, enums, missing fields, length caps;
 *   2. corroboration — each option's host is checked against the hosts Gemini
 *      reported in its grounding metadata, and the result is recorded on
 *      `verified` rather than used to silently delete entries. An unverified
 *      option is shown, labelled; the user is better served by a link they can
 *      judge than by a list quietly trimmed to nothing.
 */

import type { GroundedSource } from "../../llm/index.js";
import { REFERENCE_KINDS, type ReferenceKind, type ReferenceOption, type ReferencerLLMOutput } from "./referencer.types.js";

const MAX_TITLE = 160;
const MAX_TEXT = 400;

/** Lowercased host without "www.", or "" when the URL is unusable. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Hosts the search actually returned.
 *
 * Grounded sources arrive as vertexaisearch redirect URIs whose host is always
 * Google's, so the publisher has to come from the chunk *title*, which Gemini
 * sets to the source domain (e.g. "khanacademy.org"). Both are collected: the
 * redirect host is harmless noise, and a title that is not a domain simply never
 * matches anything.
 */
export function groundedHosts(sources: GroundedSource[]): Set<string> {
  const hosts = new Set<string>();
  for (const source of sources) {
    const fromUri = hostOf(source.uri);
    if (fromUri) hosts.add(fromUri);
    const title = source.title.trim().toLowerCase().replace(/^www\./, "");
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(title)) hosts.add(title);
  }
  return hosts;
}

/** A host matches if it is the corroborated host or a subdomain of it. */
function corroborated(host: string, hosts: Set<string>): boolean {
  if (!host) return false;
  for (const known of hosts) {
    if (host === known || host.endsWith(`.${known}`) || known.endsWith(`.${host}`)) return true;
  }
  return false;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function kindOf(value: unknown, url: string): ReferenceKind {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if ((REFERENCE_KINDS as readonly string[]).includes(raw)) return raw as ReferenceKind;
  // The model left it out or invented a word — infer from the link instead of
  // defaulting blindly, since a .pdf is the one case the UI most wants right.
  if (/\.pdf($|[?#])/i.test(url)) return "pdf";
  return "article";
}

/** Only real, fetchable web links survive. */
function usableUrl(value: unknown): string {
  const raw = text(value, 2048);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (!parsed.hostname.includes(".")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

/** Stable, readable option id: the host plus its position in the list. */
function optionId(url: string, index: number): string {
  const host = hostOf(url).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${host || "opt"}-${index + 1}`;
}

/**
 * Coerce raw model output into options. Returns only what survived — the caller
 * decides whether that is enough or whether to fall back offline.
 */
export function normalizeOptions(
  raw: ReferencerLLMOutput,
  sources: GroundedSource[],
  limit: number,
): ReferenceOption[] {
  const hosts = groundedHosts(sources);
  const seen = new Set<string>();
  const options: ReferenceOption[] = [];

  for (const entry of Array.isArray(raw.options) ? raw.options : []) {
    if (options.length >= limit) break;

    const url = usableUrl(entry?.url);
    if (!url) continue;
    // Two entries for one page is a wasted slot, not a second option.
    const key = url.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);

    const host = hostOf(url);
    const title = text(entry?.title, MAX_TITLE);
    if (!title) continue;

    options.push({
      id: optionId(url, options.length),
      title,
      url,
      source: text(entry?.source, 80) || host,
      kind: kindOf(entry?.kind, url),
      summary: text(entry?.summary, MAX_TEXT),
      whyRelevant: text(entry?.whyRelevant, MAX_TEXT),
      verified: corroborated(host, hosts),
    });
  }

  return options;
}

/**
 * Turn grounded sources into options directly.
 *
 * The safety net for when the JSON pass fails or returns nothing usable: the
 * search itself already produced real links, so the user still gets a list —
 * just without the model's descriptions.
 */
export function optionsFromSources(sources: GroundedSource[], limit: number): ReferenceOption[] {
  const seen = new Set<string>();
  const options: ReferenceOption[] = [];

  for (const source of sources) {
    if (options.length >= limit) break;
    const url = usableUrl(source.uri);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const label = text(source.title, MAX_TITLE) || hostOf(url);
    options.push({
      id: optionId(url, options.length),
      title: label,
      url,
      source: label,
      kind: "article",
      summary: "",
      whyRelevant: "",
      // Straight from the search result, so corroborated by construction.
      verified: true,
    });
  }

  return options;
}

/** Tidy the text pulled out of a fetched page before it becomes an answer key. */
export function normalizeFetchedText(raw: string, max: number): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}
