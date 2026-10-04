/**
 * Source policy for the Referencer — who is allowed to become the answer key.
 *
 * What this exists to stop: the text a chosen source yields does not merely get
 * *read*, it becomes the marking key the Evaluator grades a spoken explanation
 * against (§1.4). A wrong sentence on an open-edit page therefore does not just
 * mislead the student — it marks a correct explanation wrong. So the bar is not
 * "is this page about the topic", it is "is someone answerable for it being
 * right".
 *
 * Two mechanisms, deliberately different in strength:
 *
 *   BLOCKED — dropped outright. Not a quality judgement about any individual
 *     page: these are publishing models where *no one* is accountable (anyone
 *     can edit), where the text is a stranger's uploaded coursework, or where
 *     the page sits behind a paywall or a login. A good Wikipedia article is
 *     still an unaccountable one; what is disqualifying is the model, not the
 *     article.
 *
 *   TIERED — everything else is kept and ranked. `high` is an institution that
 *     answers for correctness (universities, government and intergovernmental
 *     bodies, peer-reviewed journals, open-textbook publishers); `medium` is a
 *     publisher with a real editorial process but no such mandate; `low` is a
 *     host we do not recognise. Low is ranked last and labelled, not hidden — an
 *     unrecognised host is often a perfectly good departmental page, and quietly
 *     deleting it leaves the user an empty list with no reason given.
 *
 * Wikipedia is blocked rather than demoted, which is the part worth saying out
 * loud: it is usually the single most *relevant* result for a school topic, so
 * nothing short of a hard block keeps it off a ranked list. The search prompt
 * tells the model to follow its reference list and offer what it cites instead —
 * which is where the accountable source was all along.
 */

import * as config from "../../config/index.js";

/** How much institutional accountability stands behind a source. */
export const SOURCE_TRUST = ["high", "medium", "low"] as const;
export type SourceTrust = (typeof SOURCE_TRUST)[number];

/** Higher sorts first. */
const RANK: Record<SourceTrust, number> = { high: 2, medium: 1, low: 0 };

/**
 * Publishing models where nobody answers for the text, plus the ones that fail
 * the "freely readable" rule. Matched against the host and every parent domain,
 * so one entry covers every subdomain and every language edition.
 */
const BLOCKED_HOSTS: readonly string[] = [
  // Open-edit wikis and their mirrors. A host label of "wikipedia" or
  // "wikimedia" is caught separately, which also covers mirrors on other TLDs.
  "wikipedia.org", "wikimedia.org", "wikibooks.org", "wikiversity.org",
  "wikisource.org", "wiktionary.org", "wikiquote.org", "wikidata.org",
  "wikinews.org", "wikivoyage.org", "wikiwand.com", "dbpedia.org",
  "everipedia.org", "alchetron.com", "fandom.com", "wikia.com", "wikihow.com",
  // Q&A, homework help and note dumps: a stranger's answer, reviewed by nobody.
  "quora.com", "answers.com", "brainly.com", "brainly.co.id", "chegg.com",
  "coursehero.com", "studocu.com", "scribd.com", "slideshare.net",
  "slideplayer.com", "studylib.net", "docplayer.info", "docplayer.net",
  "numerade.com", "bartleby.com", "doubtnut.com", "toppr.com", "gauthmath.com",
  "study.com",
  // Self-upload repositories: the file is whatever the uploader had, neither
  // site reviews it, and both gate the download behind a login.
  "academia.edu", "researchgate.net",
  // Essay mills.
  "ukessays.com", "studymoose.com", "ivypanda.com", "gradesfixer.com",
  "123helpme.com",
  // Blogging and social platforms. The host guarantees nothing about the author.
  "medium.com", "substack.com", "blogspot.com", "wordpress.com", "tumblr.com",
  "reddit.com", "facebook.com", "instagram.com", "linkedin.com", "pinterest.com",
  "tiktok.com", "x.com", "twitter.com", "kaskus.co.id", "ehow.com",
];

/**
 * Institutions that answer for correctness, beyond what the TLD rules below
 * already catch: journals, preprint servers, open-textbook publishers, and the
 * intergovernmental bodies that do not sit on a .int domain.
 */
const HIGH_TRUST_HOSTS: readonly string[] = [
  // Peer-reviewed publishers and indexes.
  "nature.com", "science.org", "sciencedirect.com", "springer.com",
  "springeropen.com", "wiley.com", "cambridge.org", "oup.com",
  "tandfonline.com", "sagepub.com", "ieee.org", "acm.org", "aps.org",
  "acs.org", "rsc.org", "ams.org", "siam.org", "aip.org", "plos.org",
  "jstor.org", "doaj.org", "projecteuclid.org", "europepmc.org",
  "elifesciences.org",
  // Preprint servers. Not peer-reviewed, but the author is named and the record
  // is permanent — which is the accountability that matters here.
  "arxiv.org", "biorxiv.org", "medrxiv.org",
  // Open textbooks and courseware: written to be taught from, licensed to be read.
  "openstax.org", "libretexts.org", "ck12.org", "oercommons.org", "saylor.org",
  "merlot.org",
  // Intergovernmental and national scientific bodies off the .gov/.int pattern.
  "who.int", "unesco.org", "un.org", "oecd.org", "worldbank.org", "ipcc.ch",
  "home.cern", "iaea.org", "nobelprize.org",
];

/**
 * Real editorial oversight, no institutional mandate. Good enough to teach from
 * and to rank above an unknown host — not good enough to outrank a university.
 */
const MEDIUM_TRUST_HOSTS: readonly string[] = [
  "britannica.com", "khanacademy.org", "bbc.co.uk", "bbc.com",
  "nationalgeographic.com", "nationalgeographic.org", "scientificamerican.com",
  "newscientist.com", "quantamagazine.org", "wolfram.com", "wolframalpha.com",
  "encyclopediaofmath.org", "edx.org", "coursera.org", "futurelearn.com",
  "brilliant.org", "amnh.org", "nhm.ac.uk", "sciencemuseum.org.uk",
];

/** A host matches an entry when it *is* that domain or sits under it. */
function under(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function matchesAny(host: string, domains: readonly string[]): boolean {
  return domains.some((domain) => under(host, domain));
}

/**
 * Academic, government and intergovernmental domains, including the country
 * forms. `.edu` alone would miss every university outside the US: ac.uk, ac.id,
 * edu.au, go.id and gouv.fr are the same claim in another registry.
 */
function institutionalTld(host: string): boolean {
  return (
    /\.(edu|gov|mil|int)$/.test(host) ||
    /\.(ac|edu|gov|go|govt|gouv)\.[a-z]{2,3}$/.test(host)
  );
}

/**
 * An open-edit mirror living on an unrelated domain. Search results carry a
 * steady supply of these, and the domain list alone would not catch them.
 */
function wikiMirror(host: string): boolean {
  return host.split(".").some((label) => label === "wikipedia" || label === "wikimedia");
}

/** Never offer this host, whatever else it has going for it. */
export function isBlockedHost(host: string): boolean {
  if (!host) return true;
  return (
    wikiMirror(host) ||
    matchesAny(host, BLOCKED_HOSTS) ||
    matchesAny(host, config.REFERENCER_BLOCKED_HOSTS)
  );
}

/** How much accountability stands behind this host. Blocked hosts never reach here. */
export function trustOfHost(host: string): SourceTrust {
  if (!host) return "low";
  if (institutionalTld(host) || matchesAny(host, HIGH_TRUST_HOSTS)) return "high";
  if (matchesAny(host, MEDIUM_TRUST_HOSTS)) return "medium";
  // Schools sit a rung below universities: real institutions publishing real
  // teaching material, but not bodies that answer for the subject itself.
  if (/\.sch\.[a-z]{2}$/.test(host)) return "medium";
  return "low";
}

/** True when this tier clears the floor the deployment configured. */
export function meetsMinTrust(
  trust: SourceTrust,
  min: SourceTrust = config.REFERENCER_MIN_TRUST,
): boolean {
  return RANK[trust] >= RANK[min];
}

/** Sort comparator: trust first, then corroboration. Relevance order breaks ties. */
export function byTrust(
  a: { trust: SourceTrust; verified: boolean },
  b: { trust: SourceTrust; verified: boolean },
): number {
  if (RANK[a.trust] !== RANK[b.trust]) return RANK[b.trust] - RANK[a.trust];
  return Number(b.verified) - Number(a.verified);
}
