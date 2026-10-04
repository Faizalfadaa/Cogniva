/**
 * The searchable index over one document's chunks (§3.7 retrieval).
 *
 * The index runs in one of two modes, and both must work:
 *
 *   vector  — chunks were embedded, so search compares meaning. Scores are
 *             blended with the keyword score, because embeddings paraphrase
 *             well but blur exact tokens: formulas, symbols, and names such as
 *             "ATP", "NADPH" or "C6H12O6" are matched by the keyword half.
 *   keyword — no embeddings available (no API key, mock mode, or the embedding
 *             call failed). Search falls back to TF-IDF over the same chunks.
 *
 * The keyword mode is not a stub: it is what keeps the offline path honest, and
 * the whole app is required to run without a credential.
 */

import type { ReferenceChunk } from "./chunker.js";

/** A chunk with the score that retrieved it. */
export interface ScoredChunk {
  chunk: ReferenceChunk;
  score: number;
}

export interface SearchOptions {
  /** How many chunks to return. */
  k: number;
  /** Weight of the keyword score when blending with vectors (0..1). */
  keywordWeight: number;
}

/** Words too common to carry meaning, in both languages the app sees. */
const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "from", "into", "are", "was", "were",
  "this", "these", "those", "have", "has", "had", "not", "but", "its", "it's",
  "yang", "dan", "atau", "untuk", "dari", "pada", "adalah", "dengan", "ini",
  "itu", "akan", "juga", "kita", "kami", "bisa", "dapat", "tidak", "ada",
  "karena", "oleh", "dalam", "sebagai", "agar", "saat", "ketika", "lalu",
]);

export class ReferenceIndex {
  readonly chunks: ReferenceChunk[];
  private readonly vectors: number[][] | null;
  /** Per-chunk term frequencies, built once at construction. */
  private readonly termFrequencies: Array<Map<string, number>>;
  /** How many chunks each term appears in — the "document frequency". */
  private readonly documentFrequencies: Map<string, number>;

  constructor(chunks: ReferenceChunk[], vectors?: number[][] | null) {
    this.chunks = chunks;
    this.vectors = vectors && vectors.length === chunks.length ? vectors : null;

    this.termFrequencies = chunks.map((chunk) => countTerms(chunk.text));
    this.documentFrequencies = new Map();
    for (const frequencies of this.termFrequencies) {
      for (const term of frequencies.keys()) {
        this.documentFrequencies.set(term, (this.documentFrequencies.get(term) ?? 0) + 1);
      }
    }
  }

  get size(): number {
    return this.chunks.length;
  }

  /** Which mode this index will search in. Surfaced for logging and tests. */
  get mode(): "vector" | "keyword" {
    return this.vectors ? "vector" : "keyword";
  }

  /**
   * Rank chunks against one query. `queryVector` is used only when the index was
   * built with embeddings; pass null to force the keyword path.
   */
  search(
    query: string,
    queryVector: number[] | null,
    { k, keywordWeight }: SearchOptions,
  ): ScoredChunk[] {
    if (this.chunks.length === 0) return [];

    const keywordScores = this.chunks.map((_, i) => this.keywordScore(query, i));

    let scores: number[];
    if (this.vectors && queryVector && queryVector.length > 0) {
      const similarities = this.vectors.map((vector) => dot(vector, queryVector));
      const weight = Math.min(1, Math.max(0, keywordWeight));
      const normalizedVector = minMax(similarities);
      const normalizedKeyword = minMax(keywordScores);
      scores = similarities.map(
        (_, i) => (1 - weight) * normalizedVector[i] + weight * normalizedKeyword[i],
      );
    } else {
      scores = keywordScores;
    }

    return scores
      .map((score, i) => ({ chunk: this.chunks[i], score }))
      .filter((scored) => scored.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, k));
  }

  /** TF-IDF overlap between the query and one chunk, damped for chunk length. */
  private keywordScore(query: string, chunkIndex: number): number {
    const frequencies = this.termFrequencies[chunkIndex];
    if (frequencies.size === 0) return 0;

    const total = this.chunks.length;
    let score = 0;
    for (const term of new Set(tokenize(query))) {
      const termFrequency = frequencies.get(term);
      if (!termFrequency) continue;
      const documentFrequency = this.documentFrequencies.get(term) ?? 1;
      const inverseDocumentFrequency = Math.log(1 + total / documentFrequency);
      // Cap the term frequency so one repeated word can't dominate the ranking.
      score += inverseDocumentFrequency * (1 + Math.log(Math.min(termFrequency, 3)));
    }
    return score / Math.sqrt(frequencies.size);
  }

  /**
   * The index as plain JSON, so it can be persisted with the workspace and
   * reloaded after a restart instead of re-chunking (and re-embedding) the PDF.
   * Only the two constructor inputs are stored; the term-frequency tables are
   * derived and rebuilt on the way back in.
   */
  toJSON(): SerializedReferenceIndex {
    return { chunks: this.chunks, vectors: this.vectors };
  }

  static fromJSON(data: SerializedReferenceIndex): ReferenceIndex {
    return new ReferenceIndex(data.chunks ?? [], data.vectors ?? null);
  }
}

/** The persisted form of a ReferenceIndex (a `reference_index` JSON column). */
export interface SerializedReferenceIndex {
  chunks: ReferenceChunk[];
  vectors: number[][] | null;
}

function countTerms(text: string): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const term of tokenize(text)) {
    frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  }
  return frequencies;
}

/**
 * Lowercase word-ish tokens. Digits are kept so "6 CO2" and "C6H12O6" survive —
 * dropping them would lose exactly the terms a science reference hinges on.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function dot(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += a[i] * b[i];
  return sum;
}

/** Rescale to 0..1 so vector and keyword scores can be blended fairly. */
function minMax(values: number[]): number[] {
  if (values.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min;
  if (span <= 0) return values.map(() => (max > 0 ? 1 : 0));
  return values.map((value) => (value - min) / span);
}
