/**
 * Deterministic offline suggestions — used with no credential, USE_MOCK_AI, or
 * after a failed search (the same fallback rule every agent follows).
 *
 * The hard constraint here is honesty. Offline there is no way to know which
 * article about a topic exists, and a made-up title over an invented URL is
 * worse than no suggestion at all: it looks authoritative and leads nowhere.
 * So the offline list never names a document. It points at the *catalog* of
 * well-known open libraries, pre-filtered to the topic, and says so plainly.
 * Every URL is a stable entry point that resolves whatever the topic is.
 *
 * Every library here also has to pass the source policy in referencer.trust.ts —
 * this list is the fallback for the same feature, so it cannot offer what the
 * online path would refuse. That is why there is no Wikipedia entry: it used to
 * lead this list, and an open-edit page is exactly what must not become a
 * marking key. Britannica takes its place for the same job (one broad,
 * encyclopedic entry point) with a named editorial process behind it.
 */

import * as config from "../../config/index.js";
import type { SourceTrust } from "./referencer.trust.js";
import type { ReferenceOption, ReferenceSuggestions, SuggestReferencesArgs } from "./referencer.types.js";

interface Library {
  id: string;
  title: (topic: string) => string;
  url: (query: string) => string;
  source: string;
  kind: ReferenceOption["kind"];
  trust: SourceTrust;
  summary: string;
  whyRelevant: string;
}

const LIBRARIES: Library[] = [
  {
    id: "britannica",
    title: (topic) => `Encyclopaedia Britannica: ${topic}`,
    url: (q) => `https://www.britannica.com/search?query=${q}`,
    source: "Encyclopaedia Britannica",
    kind: "article",
    trust: "medium",
    summary:
      "An encyclopedia whose articles carry a named author and go through editorial review.",
    whyRelevant:
      "Broad coverage under clear headings — a good opening framework, and you can see who wrote it.",
  },
  {
    id: "khan-academy",
    title: (topic) => `Khan Academy — material on ${topic}`,
    url: (q) => `https://www.khanacademy.org/search?page_search_query=${q}`,
    source: "Khan Academy",
    kind: "course",
    trust: "medium",
    summary: "Short lessons and graded exercises, written for school-age learners.",
    whyRelevant: "The wording is closest to how a person actually explains something to a beginner.",
  },
  {
    id: "openstax",
    title: (topic) => `OpenStax — open textbook on ${topic}`,
    url: (q) => `https://openstax.org/search?q=${q}`,
    source: "OpenStax",
    kind: "pdf",
    trust: "high",
    summary: "Free peer-reviewed university textbooks, available as a full PDF per chapter.",
    whyRelevant: "If you need reference material you can download as a PDF, this is the tidiest source.",
  },
  {
    id: "libretexts",
    title: (topic) => `LibreTexts — textbook chapter on ${topic}`,
    url: (q) => `https://libretexts.org/search.html?q=${q}`,
    source: "LibreTexts",
    kind: "book",
    trust: "high",
    summary:
      "An open-textbook library run by a consortium of universities, split by chapter and section.",
    whyRelevant: "University-level depth broken into small pieces, so one topic is easy to lift out.",
  },
  {
    id: "mit-ocw",
    title: (topic) => `MIT OpenCourseWare — course material on ${topic}`,
    url: (q) => `https://ocw.mit.edu/search/?q=${q}`,
    source: "MIT OpenCourseWare",
    kind: "course",
    trust: "high",
    summary: "Lecture notes, slides and problem sets from MIT courses, opened to the public.",
    whyRelevant: "The deepest material on this list; useful for advanced topics.",
  },
  {
    id: "semantic-scholar",
    title: (topic) => `Semantic Scholar — research papers on ${topic}`,
    url: (q) => `https://www.semanticscholar.org/search?q=${q}`,
    source: "Semantic Scholar",
    kind: "article",
    trust: "high",
    summary: "A search engine for scientific papers, many of them open-access PDFs.",
    whyRelevant: "Use it when the topic calls for a primary source rather than a summary.",
  },
];

const NOTICE =
  "Online search is unavailable right now, so these are entry points into open libraries, " +
  "pre-filtered for your topic — not specific document titles. Open one, then upload the PDF " +
  "if you find something that fits.";

/** Build the offline option list. Pure and deterministic. */
export function suggestOffline(args: SuggestReferencesArgs): ReferenceSuggestions {
  const topic = args.topic.trim() || "this topic";
  const query = encodeURIComponent([topic, args.hint].filter(Boolean).join(" ").trim());
  const count = Math.max(1, args.count ?? config.REFERENCER_OPTIONS);

  const options: ReferenceOption[] = LIBRARIES.slice(0, count).map((library) => ({
    id: library.id,
    title: library.title(topic),
    url: library.url(query),
    source: library.source,
    kind: library.kind,
    summary: library.summary,
    whyRelevant: library.whyRelevant,
    // Nothing was searched, so nothing is corroborated. Saying "verified" here
    // would be the exact lie this fallback exists to avoid.
    verified: false,
    // Trust is a property of the publisher, not of the search, so it is known
    // offline and stated: these are the hosts, and they do not change.
    trust: library.trust,
  }));

  return { topic, options, source: "offline", notice: NOTICE, noticeCodes: ["offline"] };
}
