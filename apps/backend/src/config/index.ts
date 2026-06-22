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

// --- Vision (§3.4) ---------------------------------------------------------

/**
 * Below this confidence the orchestrator asks the user to confirm/correct the
 * board reading instead of guessing (real Vision lands in M2).
 */
export const VISION_CONFIDENCE_THRESHOLD: number = num(
  process.env.COGNIVA_VISION_CONFIDENCE_THRESHOLD,
  0.6,
);

// --- Server ----------------------------------------------------------------

/** HTTP/WebSocket port. The frontend expects 8000 by default. */
export const PORT: number = num(process.env.PORT, 8000);

/** True when a Gemini credential is configured in the environment. */
export function llmAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}
