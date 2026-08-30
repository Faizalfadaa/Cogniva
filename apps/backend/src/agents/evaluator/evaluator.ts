/**
 * Evaluator agent — post-session assessment (Architecture Document §3.7, §5.2).
 *
 * Runs once after the session ends (status ENDED), reading the full transcript
 * plus the reference material, and returns a canonical EvaluationResult.
 *
 * The reference arrives in one of two forms (see EvaluatorInput): retrieved
 * excerpts + an outline on the RAG path, or the whole document when there is no
 * index. This file is unaffected by the difference — the prompt builder decides
 * how to render whichever form it was given. Like
 * the other agents it routes the real call through the centralized Gemini
 * wrapper (§7.3) and falls back to a deterministic offline evaluation when no
 * credential is configured or the call fails — so the debrief always renders
 * (§10). This function never throws.
 */

import * as config from "../../config/index.js";
import { LLMClient, type LLM } from "../../llm/index.js";
import { buildEvaluatorMessages, EVALUATOR_LLM_OUTPUT_SCHEMA } from "./evaluator.prompt.js";
import { normalizeEvaluation } from "./evaluator.guard.js";
import { mockEvaluator } from "./evaluator.mock.js";
import type { EvaluationResult, EvaluatorInput } from "./types.js";

export interface RunEvaluatorOptions {
  /** Force the deterministic offline evaluator (tests/offline demos). */
  useMock?: boolean;
  /** Inject an LLM seam (tests). When set, the real path is used with it. */
  llm?: LLM;
}

export async function runEvaluator(
  input: EvaluatorInput,
  evaluationId: string,
  options: RunEvaluatorOptions = {},
): Promise<EvaluationResult> {
  const useMockAI =
    options.useMock === true ||
    process.env.USE_MOCK_AI === "true" ||
    (!options.llm && !config.llmAvailable());

  if (useMockAI) {
    return mockEvaluator(input, evaluationId);
  }

  try {
    const messages = buildEvaluatorMessages(input);
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const user = messages.find((m) => m.role === "user")?.content ?? "";

    const llm =
      options.llm ??
      new LLMClient({
        model: config.EVALUATOR_MODEL,
        maxTokens: config.LLM_MAX_TOKENS,
        timeout: config.LLM_TIMEOUT,
        thinkingBudget: config.LLM_THINKING_BUDGET,
      });

    const raw = await llm.structured({
      system,
      user,
      schema: EVALUATOR_LLM_OUTPUT_SCHEMA,
    });
    return normalizeEvaluation(raw, input.sessionId, evaluationId);
  } catch (error) {
    console.error("[EvaluatorAgent] Failed, using deterministic fallback:", error);
    return mockEvaluator(input, evaluationId);
  }
}
