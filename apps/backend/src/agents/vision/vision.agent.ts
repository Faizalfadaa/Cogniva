import { buildVisionMessages, VISION_LLM_OUTPUT_SCHEMA } from "../../llm/prompts/vision.prompt.js";
import { LLMClient } from "../../llm/index.js";
import * as config from "../../config/index.js";
import {
  createFallbackInterpretation,
  normalizeVisionLLMOutput,
  toVisionInterpretation,
} from "./vision.guard.js";
import { mockVisionAI } from "./vision.mock.js";
import type {
  RunVisionOptions,
  VisionAgentInput,
  VisionInterpretation,
  VisionLLMOutput,
} from "./vision.types.js";

/**
 * Jalankan satu pembacaan papan. Dipanggil oleh VisionAgent (agents/vision/index.ts)
 * hanya ketika ada gambar untuk dibaca -- jalur typedText tetap memakai
 * jalan pintas tanpa model di VisionAgent, sesuai stub M1 yang sudah ada.
 */
export async function runVisionTurn(
  input: VisionAgentInput,
  options: RunVisionOptions = {},
): Promise<VisionInterpretation> {
  try {
    const useMockAI =
      options.useMock === true ||
      process.env.USE_MOCK_AI === "true" ||
      !config.llmAvailable();

    const rawOutput: VisionLLMOutput = useMockAI
      ? mockVisionAI(input)
      : normalizeVisionLLMOutput(await callRealAI(input));

    return toVisionInterpretation(
      rawOutput,
      input.snapshotId,
      config.VISION_CONFIDENCE_THRESHOLD,
    );
  } catch (error) {
    console.error("[VisionAgent] Failed to run turn:", error);
    return createFallbackInterpretation(input.snapshotId);
  }
}

/**
 * Jalur LLM nyata -- lewat pembungkus Gemini terpusat proyek (§7.3).
 *
 * CATATAN INTEGRASI: ini butuh StructuredArgs.image, field yang BELUM ada
 * di llm/providers/gemini.ts saat ini (wrapper itu baru menangani teks,
 * dipakai Learner). Lihat GAPS_VISION.md untuk diff minimal yang diusulkan
 * agar wrapper bisa menerima gambar tanpa mengubah cara Learner memakainya.
 */
async function callRealAI(input: VisionAgentInput): Promise<Record<string, unknown>> {
  const messages = buildVisionMessages(input);
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  const llm = new LLMClient({
    model: config.VISION_MODEL,
    maxTokens: config.VISION_MAX_TOKENS,
    timeout: config.LLM_TIMEOUT,
    thinkingBudget: config.LLM_THINKING_BUDGET,
  });

  return llm.structured({
    system,
    user,
    schema: VISION_LLM_OUTPUT_SCHEMA,
    image: { data: input.imageBase64, mimeType: input.mimeType },
  });
}
