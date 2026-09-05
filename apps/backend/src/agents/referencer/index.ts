/**
 * Referencer agent — the front door (§3.7, reference sourcing).
 *
 * Sits beside the other agents rather than inside the teaching loop: it runs
 * when the user asks for reading material, not once per turn. The §2.3 rule
 * still holds — it calls no other agent, and the workspace service is what wires
 * its output into the reference pipeline.
 *
 * INVARIANT (§1.4): what this agent produces is an answer key. It flows to the
 * Evaluator only; the Learner never sees a suggested source or its text.
 */

import { fetchReferenceText, suggestReferences } from "./referencer.agent.js";
import type { FetchedReference, ReferenceSuggestions, SuggestReferencesArgs } from "./referencer.types.js";

export { fetchReferenceText, suggestReferences } from "./referencer.agent.js";
export { suggestOffline } from "./referencer.mock.js";
export { fetchSourceText, htmlToText } from "./referencer.fetch.js";
export {
  groundedHosts,
  hostOf,
  normalizeFetchedText,
  normalizeOptions,
  optionsFromSources,
} from "./referencer.guard.js";
export { REFERENCE_KINDS } from "./referencer.types.js";
export type {
  FetchedReference,
  ReferenceKind,
  ReferenceOption,
  ReferenceSuggestions,
  ReferenceSuggestionSource,
  ReferencerLLMOutput,
  SuggestReferencesArgs,
} from "./referencer.types.js";

export class ReferencerAgent {
  constructor(private readonly defaults: Partial<SuggestReferencesArgs> = {}) {}

  suggest(args: SuggestReferencesArgs): Promise<ReferenceSuggestions> {
    return suggestReferences({ ...this.defaults, ...args });
  }

  read(url: string, topic: string): Promise<FetchedReference> {
    return fetchReferenceText(url, topic, {
      useMock: this.defaults.useMock,
      onUsage: this.defaults.onUsage,
    });
  }
}
