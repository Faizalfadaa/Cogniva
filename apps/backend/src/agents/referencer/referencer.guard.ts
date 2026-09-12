/**
 * Guard for the Referencer — model output is untrusted (see CLAUDE.md).
 *
 * The specific risk here is not a malformed shape, it is a *convincing* one: a
 * model writing a reference list will happily produce a well-formed entry whose
 * URL was never returned by any search. So this guard does three jobs:
 *
 *   1. the usual coercion — types, enums, missing fields, length caps;
 *   2. corroboration — each option's host is checked against the hosts Gemini
 *      reported in its grounding metadata, and the result is recorded on
 *      `verified` rather than used to silently delete entries. An unverified
 *      option is shown, labelled; the user is better served by a link they can
 *      judge than by a list quietly trimmed to nothing.
 *   3. accountability — the host is put through the source policy in
 *      referencer.trust.ts. This one *does* delete: a page nobody answers for
 *      cannot be a marking key, however well the model described it. The
 *      survivors are tiered and the list is ordered by tier, so the most
 *      accountable source is the one the user sees first.
 *
 * Two, and three, disagree often and that is the point: a search will happily
 * corroborate a Wikipedia link. Verified says "this link is real"; trust says
 * "someone is answerable for it". Only the second is a claim about correctness.
 */

import type { GroundedSource } from "../../llm/index.js";
import { byTrust, isBlockedHost, meetsMinTrust, trustOfHost } from "./referencer.trust.js";
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

/**
 * The publisher behind a grounded source.
 *
 * Needed because the source policy has to be applied to the *publisher*, not to
 * the link: a grounded result is a vertexaisearch redirect on Google's own host,
 * so judging `uri` would wave every one of them through — a redirect to
 * Wikipedia included. Gemini puts the real domain in the chunk title, so that is
 * what gets checked; a title that is not a domain falls back to the URI's host,
 * which then fails the policy on its own merits.
 */
function publisherHost(source: GroundedSource): string {
  const title = source.title.trim().toLowerCase().replace(/^www\./, "");
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(title)) return title;
  return hostOf(source.uri);
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
 * What a guard pass produced.
 *
 * `rejected` is carried out rather than logged and forgotten because the caller
 * has two decisions to make with it: whether to tell the user that the list was
 * filtered (a short list with no explanation reads as a broken search), and
 * whether to search again while naming the hosts to avoid.
 */
export interface GuardedOptions {
  options: ReferenceOption[];
  /** Hosts dropped for accountability, not for being malformed. Deduplicated. */
  rejected: string[];
}

/**
 * Coerce raw model output into options. Returns only what survived — the caller
 * decides whether that is enough or whether to fall back offline.
 *
 * The limit is applied *after* sorting, not while collecting: the model orders
 * by relevance, so cutting at four first and ranking second would throw away a
 * university page sitting fifth behind four unrecognised blogs.
 */
export function normalizeOptions(
  raw: ReferencerLLMOutput,
  sources: GroundedSource[],
  limit: number,
): GuardedOptions {
  const hosts = groundedHosts(sources);
  const seen = new Set<string>();
  const rejected = new Set<string>();
  const options: ReferenceOption[] = [];

  for (const entry of Array.isArray(raw.options) ? raw.options : []) {
    const url = usableUrl(entry?.url);
    if (!url) continue;
    // Two entries for one page is a wasted slot, not a second option.
    const key = url.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);

    const host = hostOf(url);
    const title = text(entry?.title, MAX_TITLE);
    if (!title) continue;

    const trust = trustOfHost(host);
    if (isBlockedHost(host) || !meetsMinTrust(trust)) {
      rejected.add(host);
      continue;
    }

    options.push({
      id: "",
      title,
      url,
      source: text(entry?.source, 80) || host,
      kind: kindOf(entry?.kind, url),
      summary: text(entry?.summary, MAX_TEXT),
      whyRelevant: text(entry?.whyRelevant, MAX_TEXT),
      verified: corroborated(host, hosts),
      trust,
    });
  }

  return { options: rank(options, limit), rejected: [...rejected] };
}

/**
 * Order by accountability, cut to the limit, then hand out ids.
 *
 * Ids come last because they carry the position in the list, and the position
 * is only settled once the ranking is.
 */
function rank(options: ReferenceOption[], limit: number): ReferenceOption[] {
  return [...options]
    .sort(byTrust)
    .slice(0, Math.max(0, limit))
    .map((option, index) => ({ ...option, id: optionId(option.url, index) }));
}

/**
 * Turn grounded sources into options directly.
 *
 * The safety net for when the JSON pass fails or returns nothing usable: the
 * search itself already produced real links, so the user still gets a list —
 * just without the model's descriptions.
 *
 * The source policy applies here too. A link being genuinely returned by Google
 * says nothing about whether anyone answers for its contents, and this path
 * exists precisely when the model's own judgement has dropped out.
 */
export function optionsFromSources(sources: GroundedSource[], limit: number): GuardedOptions {
  const seen = new Set<string>();
  const rejected = new Set<string>();
  const options: ReferenceOption[] = [];

  for (const source of sources) {
    const url = usableUrl(source.uri);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const host = publisherHost(source);
    const trust = trustOfHost(host);
    if (isBlockedHost(host) || !meetsMinTrust(trust)) {
      rejected.add(host);
      continue;
    }

    const label = text(source.title, MAX_TITLE) || host;
    options.push({
      id: "",
      title: label,
      url,
      source: label,
      kind: "article",
      summary: "",
      whyRelevant: "",
      // Straight from the search result, so corroborated by construction.
      verified: true,
      trust,
    });
  }

  return { options: rank(options, limit), rejected: [...rejected] };
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
