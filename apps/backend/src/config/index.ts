/**
 * Runtime configuration (read from environment).
 *
 * Centralizes the knobs the orchestrator and agents need. Nothing here is a
 * secret by itself — the Gemini API key is read by the SDK from the
 * environment, we only check for its presence to decide whether the real LLM
 * path is available or we should fall back to a deterministic Learner.
 */

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value !== undefined && value !== "" ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

// --- LLM wrapper (Architecture Document §3.3, §7.3) ------------------------

/**
 * Default to a fast Gemini model suited to the real-time teaching loop. Teams
 * may set COGNIVA_LEARNER_MODEL=gemini-2.5-pro for higher-quality responses.
 */
export const LEARNER_MODEL: string =
  process.env.COGNIVA_LEARNER_MODEL ?? "gemini-2.5-flash";

export const LLM_MAX_TOKENS: number = num(process.env.COGNIVA_LLM_MAX_TOKENS, 2048);

/** Request timeout in seconds. */
export const LLM_TIMEOUT: number = num(process.env.COGNIVA_LLM_TIMEOUT, 60);

/**
 * Thinking-token budget for the model. 0 disables thinking — best for the
 * low-latency, structured Learner turn on gemini-2.5-flash (thinking tokens
 * otherwise eat into maxOutputTokens and can truncate the JSON). Set to -1 for
 * the model's dynamic budget if you switch to a model that needs reasoning.
 */
export const LLM_THINKING_BUDGET: number = num(
  process.env.COGNIVA_LLM_THINKING_BUDGET,
  0,
);

// --- Planner / Orchestrator (§3.3) -----------------------------------------

/**
 * The Planner decides the order of work for a turn (which agents run, and
 * whether any can be skipped). It is a small, cheap call on purpose — the fast
 * model is the right default; a stronger one buys little for a scheduling
 * decision but is paid on every turn.
 */
export const PLANNER_MODEL: string =
  process.env.COGNIVA_PLANNER_MODEL ?? "gemini-2.5-flash";

/**
 * A plan is a handful of step names and one-line reasons, so it needs far fewer
 * tokens than the agents' outputs. Keeping it small also keeps the extra latency
 * the Planner adds to the teaching loop small.
 */
export const PLANNER_MAX_TOKENS: number = num(process.env.COGNIVA_PLANNER_MAX_TOKENS, 512);

/**
 * "auto" plans with the model when a credential is configured and falls back to
 * the deterministic rules otherwise. Set COGNIVA_PLANNER_MODE=rules to force the
 * rule engine even with a key — the same decisions, zero extra latency, which is
 * what you want for load tests and for reproducible demos.
 */
export const PLANNER_MODE: "auto" | "rules" =
  process.env.COGNIVA_PLANNER_MODE === "rules" ? "rules" : "auto";

/**
 * Hard ceiling on steps per teaching turn (§S8 budgets). A full turn is
 * read_board -> verify_board -> transcribe_audio -> ask_learner; the extra slot
 * is headroom so a re-plan cannot strand a turn before it reaches the student.
 */
export const PLANNER_MAX_STEPS: number = num(process.env.COGNIVA_PLANNER_MAX_STEPS, 5);

/**
 * How many times one turn may ask for a new plan after a step surprises it
 * (typically: the board came back unreadable). Each re-plan is one extra model
 * call, so one is usually the right number.
 */
export const PLANNER_MAX_REPLANS: number = num(process.env.COGNIVA_PLANNER_MAX_REPLANS, 1);

// --- Vision (§3.4) ---------------------------------------------------------

/**
 * Multimodal model for board reading. Defaults to the same fast model as the
 * Learner since gemini-2.5-flash already supports image input; set
 * COGNIVA_VISION_MODEL to override independently (e.g. a stronger model if
 * handwriting accuracy needs it more than latency).
 */
export const VISION_MODEL: string =
  process.env.COGNIVA_VISION_MODEL ?? "gemini-2.5-flash";

/**
 * Vision's own output-token budget, separate from the shared LLM_MAX_TOKENS
 * (2048) used by Learner/ASR/Evaluator. A dense whiteboard can have 20+
 * elements, each needing kind+content+confidence+location in the JSON
 * response -- 2048 was observed truncating mid-string on a busy board
 * (photosynthesis diagram with two staged sub-diagrams + factors list).
 * Override with COGNIVA_VISION_MAX_TOKENS if even denser boards still
 * truncate.
 */
export const VISION_MAX_TOKENS: number = num(
  process.env.COGNIVA_VISION_MAX_TOKENS,
  4096,
);
/**
 * Below this confidence the orchestrator asks the user to confirm/correct the
 * board reading instead of guessing (real Vision lands in M2).
 */
export const VISION_CONFIDENCE_THRESHOLD: number = num(
  process.env.COGNIVA_VISION_CONFIDENCE_THRESHOLD,
  0.6,
);

// --- Evaluator (§3.7) ------------------------------------------------------

/**
 * Text model for post-session evaluation. Defaults to the same fast model as the
 * Learner; set COGNIVA_EVALUATOR_MODEL=gemini-2.5-pro for a more thorough
 * assessment (latency is not critical here — it runs once, after the session).
 */
export const EVALUATOR_MODEL: string =
  process.env.COGNIVA_EVALUATOR_MODEL ?? "gemini-2.5-flash";

// --- Retrieval / RAG for the Evaluator (§3.7) ------------------------------

/**
 * Embedding model used to index the reference material and to embed retrieval
 * queries. `gemini-embedding-001` is the current model; older ids such as
 * `text-embedding-004` are no longer served on v1beta.
 */
export const EMBEDDING_MODEL: string =
  process.env.COGNIVA_EMBEDDING_MODEL ?? "gemini-embedding-001";

/**
 * Output dimensionality requested from the embedding model. The model's native
 * size is 3072; asking for fewer truncates the vector, which keeps the in-memory
 * index small. Truncated vectors are NOT unit-length, so the client re-normalizes
 * them — cosine similarity then reduces to a plain dot product.
 */
export const EMBEDDING_DIMENSIONS: number = num(
  process.env.COGNIVA_EMBEDDING_DIMENSIONS,
  768,
);

/** How many texts go in one embedContent call. Keeps requests well under limits. */
export const EMBEDDING_BATCH_SIZE: number = num(
  process.env.COGNIVA_EMBEDDING_BATCH_SIZE,
  32,
);

/** Target size of one reference chunk, in characters. */
export const RAG_CHUNK_SIZE: number = num(process.env.COGNIVA_RAG_CHUNK_SIZE, 900);

/**
 * Characters of the preceding text carried into each chunk. Overlap keeps a
 * sentence that straddles a chunk boundary readable in at least one chunk.
 */
export const RAG_CHUNK_OVERLAP: number = num(
  process.env.COGNIVA_RAG_CHUNK_OVERLAP,
  150,
);

/** Chunks retrieved per query before the results of all queries are merged. */
export const RAG_TOP_K: number = num(process.env.COGNIVA_RAG_TOP_K, 3);

/** Upper bound on the merged excerpt set handed to the Evaluator prompt. */
export const RAG_MAX_CHUNKS: number = num(process.env.COGNIVA_RAG_MAX_CHUNKS, 8);

/** Upper bound on how many queries one evaluation may embed (cost guard). */
export const RAG_MAX_QUERIES: number = num(process.env.COGNIVA_RAG_MAX_QUERIES, 12);

/**
 * Weight of the keyword score when blending with vector similarity (0..1).
 * Vectors capture meaning; keywords catch exact tokens a paraphrase would miss —
 * formulas, symbols, and names such as "ATP", "NADPH", "C6H12O6".
 */
export const RAG_KEYWORD_WEIGHT: number = num(
  process.env.COGNIVA_RAG_KEYWORD_WEIGHT,
  0.3,
);

/** Entries in the outline of the whole document sent alongside the excerpts. */
export const RAG_MAX_OUTLINE_ENTRIES: number = num(
  process.env.COGNIVA_RAG_MAX_OUTLINE_ENTRIES,
  60,
);

/**
 * Sanity bound on extracted reference text. Chunking replaced the old 20k
 * truncation, so this only guards against a pathologically large upload.
 */
export const RAG_MAX_REFERENCE_CHARS: number = num(
  process.env.COGNIVA_RAG_MAX_REFERENCE_CHARS,
  400_000,
);

// --- ASR (§3.5) ------------------------------------------------------------

/**
 * Speech-to-text model. Defaults to the same fast multimodal model as Vision
 * (gemini-2.5-flash already accepts inline audio); set COGNIVA_ASR_MODEL to
 * override independently if transcription accuracy needs a stronger model.
 */
export const ASR_MODEL: string =
  process.env.COGNIVA_ASR_MODEL ?? "gemini-2.5-flash";

/**
 * Default BCP-47 language used when the model returns no language code. The app
 * is Indonesian-first, so we fall back to "id-ID" rather than the contract's
 * "en-US" example.
 */
export const ASR_DEFAULT_LANGUAGE: string =
  process.env.COGNIVA_ASR_DEFAULT_LANGUAGE ?? "id-ID";

/**
 * Below this confidence the frontend shows the transcript for the user to
 * correct instead of trusting it silently (§3.5, §5.3). The SpeechTranscript
 * contract has no needsConfirmation flag, so this threshold is advisory — see
 * GAPS_ASR.md.
 */
export const ASR_CONFIDENCE_THRESHOLD: number = num(
  process.env.COGNIVA_ASR_CONFIDENCE_THRESHOLD,
  0.6,
);

// --- Token budget (§7.3 cost control) --------------------------------------

/**
 * Ceiling on the tokens one session may spend across all its turns. Once a
 * session is at or over this, the orchestrator refuses the turn instead of
 * calling any model, so a runaway session can't drain the shared quota.
 */
export const SESSION_TOKEN_BUDGET: number = num(
  process.env.COGNIVA_SESSION_TOKEN_BUDGET,
  50000,
);

/**
 * Presentation escape hatch: skip budget ENFORCEMENT so a live demo can't be
 * cut off mid-sentence. Usage is still measured and recorded either way — we
 * want to be able to answer "how many tokens did that cost?" afterwards.
 */
export const DEMO_MODE: boolean = bool(process.env.COGNIVA_DEMO_MODE, false);

// --- Server ----------------------------------------------------------------

/** HTTP/WebSocket port. The frontend expects 8000 by default. */
export const PORT: number = num(process.env.PORT, 8000);

/** True when a Gemini credential is configured in the environment. */
export function llmAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}
