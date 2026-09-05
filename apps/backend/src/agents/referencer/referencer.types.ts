/**
 * Referencer types — the agent that finds reading material for a session.
 *
 * The problem it solves: a workspace is graded against reference material the
 * user uploads (§3.7). A user who has no PDF of their own gets no answer key, so
 * the Evaluator falls back to judging explanation quality alone. This agent
 * offers a handful of real, checkable sources instead, and turns the one the
 * user picks into that reference text.
 *
 * INVARIANT (§1.4): everything here feeds the *Evaluator* side of the system.
 * Suggested sources and their fetched text never reach the Learner — the student
 * persona must not hold the answer key it is supposed to be taught from.
 */

/** What kind of thing a suggestion points at. Drives the icon the UI shows. */
export const REFERENCE_KINDS = ["article", "pdf", "course", "video", "book"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

/** One option offered to the user. */
export interface ReferenceOption {
  /** Stable within a suggestion list, so the UI can select one without the URL. */
  id: string;
  title: string;
  url: string;
  /** Publisher/site the material comes from, e.g. "Khan Academy", "arxiv.org". */
  source: string;
  kind: ReferenceKind;
  /** One or two sentences on what the material covers. */
  summary: string;
  /** Why this one is a good fit for the topic being taught. */
  whyRelevant: string;
  /**
   * True when the URL's host also appeared in Gemini's grounding metadata — i.e.
   * the model did not merely write the link, a search actually returned it.
   * Unverified options are still shown; they are simply the weaker ones, and the
   * fetch step is what ultimately decides whether a link is real.
   */
  verified: boolean;
}

/** A whole set of options, plus how it was produced. */
export interface ReferenceSuggestions {
  topic: string;
  options: ReferenceOption[];
  /** "search" = grounded model call; "offline" = the deterministic fallback. */
  source: ReferenceSuggestionSource;
  /**
   * Shown to the user when the list is weaker than it looks — offline mode, or a
   * search that came back thin. Empty when there is nothing to disclose.
   */
  notice: string;
}

export type ReferenceSuggestionSource = "search" | "offline";

/** What the agent knows when it goes looking. */
export interface SuggestReferencesArgs {
  /** The workspace title, or whatever the user called the subject. */
  topic: string;
  /** The workspace description, when the user wrote one. */
  description?: string;
  /** Free-text steer from the user ("for high school", "in Indonesian"). */
  hint?: string;
  /** How many options to return. Defaults to config.REFERENCER_OPTIONS. */
  count?: number;
  /** Force the offline list (tests, demos). */
  useMock?: boolean;
  /**
   * Reports token cost back to the caller (§7.3), same seam the other agents
   * use. Called once per model call, so a suggestion run reports twice.
   */
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
}

/** The text pulled out of a chosen source, ready to become reference material. */
export interface FetchedReference {
  url: string;
  title: string;
  text: string;
  /** False when the page could not be read; `text` is then empty. */
  ok: boolean;
  /** Human-readable reason when `ok` is false. */
  problem: string;
}

/** Raw model output for the JSON pass, before the guard gets to it. */
export type ReferencerLLMOutput = {
  options?: Array<{
    title?: string;
    url?: string;
    source?: string;
    kind?: string;
    summary?: string;
    whyRelevant?: string;
  }>;
};
