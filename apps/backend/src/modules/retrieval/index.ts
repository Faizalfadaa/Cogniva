/**
 * Retrieval for the Evaluator — the "R" in RAG (Architecture Document §3.7).
 *
 * Before this module the whole reference document was truncated at 20k
 * characters and pasted into the Evaluator prompt. Now the document is chunked
 * and indexed once, and each evaluation retrieves only the passages relevant to
 * what the user actually taught.
 *
 *     PDF text ──> chunkText ──> embed (best effort) ──> ReferenceIndex
 *     transkrip ──> queries ──> embed query ──> search ──> excerpts + outline
 *
 * INVARIANT (§1.4): retrieval exists for the Evaluator ONLY. The Learner must
 * never be given a retriever — a student who can look up the answer key stops
 * being a student. Nothing here is exported to the Learner path.
 *
 * Degradation is deliberate at every step: no API key, mock mode, or a failed
 * embedding call all land in keyword mode rather than an error, so the debrief
 * still renders offline (§10).
 */

import * as config from "../../config/index.js";
import { EmbeddingClient, type Embedder } from "../../llm/index.js";
import { chunkLabel, chunkText } from "./chunker.js";
import { ReferenceIndex, type ScoredChunk } from "./referenceIndex.js";

export { chunkText, chunkLabel } from "./chunker.js";
export type { ReferenceChunk } from "./chunker.js";
export { ReferenceIndex, tokenize } from "./referenceIndex.js";
export type { ScoredChunk, SerializedReferenceIndex } from "./referenceIndex.js";

/** One retrieved passage, in the shape the Evaluator agent consumes. */
export interface ReferenceExcerpt {
  /** Human-readable origin, e.g. "bagian 3 · Light reactions". */
  label: string;
  text: string;
}

export interface BuildIndexOptions {
  /** Inject an embedder (tests). Omit to use the configured Gemini client. */
  embedder?: Embedder | null;
  /** Skip embedding entirely and build a keyword-only index. */
  keywordOnly?: boolean;
  /** Chunk size in characters; defaults to the configured value. */
  size?: number;
  /** Overlap in characters; defaults to the configured value. */
  overlap?: number;
}

/**
 * The embedder to use, or null when the system is running without a credential
 * or has been forced into mock mode.
 */
export function defaultEmbedder(): Embedder | null {
  if (process.env.USE_MOCK_AI === "true" || !config.llmAvailable()) return null;
  return new EmbeddingClient({
    model: config.EMBEDDING_MODEL,
    dimensions: config.EMBEDDING_DIMENSIONS,
    timeout: config.LLM_TIMEOUT,
    batchSize: config.EMBEDDING_BATCH_SIZE,
  });
}

/**
 * Chunk `text` and, when possible, embed the chunks. Never throws: a failed
 * embedding call returns a keyword-only index rather than losing the document.
 */
export async function buildReferenceIndex(
  text: string,
  options: BuildIndexOptions = {},
): Promise<ReferenceIndex> {
  const chunks = chunkText(text, {
    size: options.size ?? config.RAG_CHUNK_SIZE,
    overlap: options.overlap ?? config.RAG_CHUNK_OVERLAP,
  });
  if (chunks.length === 0) return new ReferenceIndex([], null);

  const embedder = options.keywordOnly
    ? null
    : options.embedder !== undefined
      ? options.embedder
      : defaultEmbedder();
  if (!embedder) return new ReferenceIndex(chunks, null);

  try {
    const vectors = await embedder.embed({
      texts: chunks.map((chunk) => chunk.text),
      taskType: "RETRIEVAL_DOCUMENT",
    });
    return new ReferenceIndex(chunks, vectors);
  } catch (error) {
    console.error("[retrieval] embedding failed, falling back to keyword search:", error);
    return new ReferenceIndex(chunks, null);
  }
}

export interface RetrieveOptions {
  /** Inject an embedder (tests). Omit to use the configured Gemini client. */
  embedder?: Embedder | null;
  /** Chunks per query before merging. Defaults to the configured top-k. */
  topK?: number;
  /** Hard cap on the merged result. Defaults to the configured maximum. */
  maxChunks?: number;
}

/**
 * Retrieve the passages most relevant to `queries`.
 *
 * Each query is searched separately and the results are merged by best score,
 * because a session covers several sub-topics and one blended query would drift
 * to the average of them. The merged set is returned in document order, so the
 * Evaluator reads the reference the way it was written rather than in score
 * order.
 */
export async function retrieveExcerpts(
  index: ReferenceIndex,
  queries: string[],
  options: RetrieveOptions = {},
): Promise<ReferenceExcerpt[]> {
  const usableQueries = queries
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter((query) => query.length >= 12)
    .slice(0, config.RAG_MAX_QUERIES);

  if (index.size === 0 || usableQueries.length === 0) return [];

  const queryVectors = await embedQueries(index, usableQueries, options.embedder);

  const best = new Map<number, ScoredChunk>();
  usableQueries.forEach((query, i) => {
    const hits = index.search(query, queryVectors?.[i] ?? null, {
      k: options.topK ?? config.RAG_TOP_K,
      keywordWeight: config.RAG_KEYWORD_WEIGHT,
    });
    for (const hit of hits) {
      const existing = best.get(hit.chunk.index);
      if (!existing || hit.score > existing.score) best.set(hit.chunk.index, hit);
    }
  });

  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, options.maxChunks ?? config.RAG_MAX_CHUNKS)
    .sort((a, b) => a.chunk.index - b.chunk.index)
    .map(({ chunk }) => ({ label: chunkLabel(chunk), text: chunk.text }));
}

/**
 * A one-line-per-chunk map of the WHOLE document.
 *
 * This is what keeps "MISSED" findings honest. Retrieval is biased towards what
 * the user did say, so excerpts alone can never reveal a concept the user never
 * mentioned. The outline restores that view cheaply — the Evaluator sees the
 * document's full scope without being handed its full text.
 */
export function buildOutline(index: ReferenceIndex): string[] {
  return index.chunks
    .slice(0, config.RAG_MAX_OUTLINE_ENTRIES)
    .map((chunk) => chunkLabel(chunk));
}

async function embedQueries(
  index: ReferenceIndex,
  queries: string[],
  injected: Embedder | null | undefined,
): Promise<number[][] | null> {
  if (index.mode !== "vector") return null;

  const embedder = injected !== undefined ? injected : defaultEmbedder();
  if (!embedder) return null;

  try {
    return await embedder.embed({ texts: queries, taskType: "RETRIEVAL_QUERY" });
  } catch (error) {
    console.error("[retrieval] query embedding failed, using keyword search:", error);
    return null;
  }
}

/**
 * Turn a session transcript into retrieval queries: one per turn, plus any
 * curated key concepts. Turn text is what the user actually explained, which is
 * exactly what the reference should be searched for.
 */
export function queriesFromTranscript(
  turns: Array<{ boardText?: string; speech?: string }>,
  keyConcepts: string[] = [],
): string[] {
  const fromTurns = turns.map((turn) =>
    [turn.boardText, turn.speech].filter(Boolean).join(" ").slice(0, 600),
  );
  return [...fromTurns, ...keyConcepts].filter((query) => query.trim().length > 0);
}
