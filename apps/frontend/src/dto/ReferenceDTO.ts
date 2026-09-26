/**
 * Reference sourcing — what the Referencer agent offers when the user has no
 * reference material of their own (backend: src/agents/referencer).
 *
 * Mirrors the backend contract 1:1, like every DTO here: the bridge does no
 * field remapping, so any drift between the two is a silent runtime bug.
 *
 * These describe the *Evaluator's* answer key. Nothing here is ever shown to the
 * learner persona — that is the §1.4 invariant the whole grading design rests on.
 */

export type ReferenceKind = 'article' | 'pdf' | 'course' | 'video' | 'book'

/**
 * How much institutional accountability stands behind the publisher.
 *
 * 'high' = university, government body, journal, or open-textbook publisher;
 * 'medium' = a publisher with a named editorial process; 'low' = a host the
 * backend does not recognise. Sources with no accountability at all — open-edit
 * wikis, Q&A sites, note dumps — are dropped by the backend and never arrive.
 */
export type SourceTrust = 'high' | 'medium' | 'low'

/** One option the user can choose. */
export interface ReferenceOptionDTO {
  id: string
  title: string
  url: string
  /** Publisher/site, e.g. 'Khan Academy'. */
  source: string
  kind: ReferenceKind
  summary: string
  whyRelevant: string
  /**
   * True when a real search returned this host, false when only the model
   * named it. Shown to the user rather than used to hide anything.
   */
  verified: boolean
  /** Who answers for this source being correct. Drives the badge on the card. */
  trust: SourceTrust
}

export interface ReferenceSuggestionsDTO {
  topic: string
  options: ReferenceOptionDTO[]
  /** 'search' = a live search ran; 'offline' = the deterministic library list. */
  source: 'search' | 'offline'
  /** Caveat to show above the list. Empty when there is nothing to disclose. */
  notice: string
  /** `notice` as stable codes, so it can be shown in the reader's language. */
  noticeCodes?: Array<'thin' | 'unverified' | 'rejected' | 'offline'>
}

/** Where reference material came from, when it was not an uploaded PDF. */
export interface ReferenceSourceDTO {
  url: string
  title: string
  source: string
}

/** Result of adopting one option as the session's reference material. */
export interface UseReferenceResultDTO {
  ok: boolean
  /** Why it could not be used, in English. Empty when ok. */
  problem: string
  /** Characters of reference text extracted. */
  chars: number
}

/** Result of saving reference material the user typed in themselves. */
export interface SaveReferenceTextResultDTO {
  workspace: import('./WorkspaceDTO').WorkspaceDTO
  /** Characters stored, after trimming. */
  chars: number
}
