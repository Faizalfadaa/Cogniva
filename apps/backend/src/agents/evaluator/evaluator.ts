import crypto from "node:crypto";
import { EvaluatorInput, EvaluationResult } from "./types";
import { createGeminiClient } from "./geminiClient";
import { buildEvaluatorPrompt } from "./promptBuilder";
import { parseEvaluationResult } from "./parser";

export async function runEvaluator(
  input: EvaluatorInput,
  apiKey: string,
  maxRetries: number = 3
): Promise<EvaluationResult> {
  const client = createGeminiClient(apiKey);
  const prompt = buildEvaluatorPrompt(input);
  
  const uuid = crypto.randomUUID();
  const evaluationId = `ev_${uuid.substring(0, 8)}`;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s * attempt
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }

      const rawResponse = await client.generate(prompt);
      return parseEvaluationResult(rawResponse, input.sessionId, evaluationId);
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw new Error(`Evaluator failed after ${maxRetries} retries. Last error: ${lastError?.message}`);
}
