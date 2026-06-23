/**
 * Gemini LLM wrapper (Architecture Document §3.3, §7.3).
 *
 * A thin, centralized layer so every agent calls the model the same way:
 * uniform model id, timeout, retries (handled by the SDK), and structured-JSON
 * output parsing. Agents never import the Google GenAI SDK directly — they go
 * through this wrapper, which keeps the model provider swappable behind one seam.
 *
 * Structured output uses Gemini's JSON mode: responseMimeType "application/json"
 * plus responseJsonSchema, so the model is constrained to emit a JSON object
 * conforming to the caller's schema.
 */

import { GoogleGenAI } from "@google/genai";

/** A recoverable failure from the LLM layer (callers fall back). */
export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

export interface StructuredArgs {
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

/**
 * The seam every agent depends on. Keeping this an interface (rather than the
 * concrete class) lets tests inject a fake without the SDK, and keeps the model
 * provider swappable.
 */
export interface LLM {
  structured(args: StructuredArgs): Promise<Record<string, unknown>>;
}

/** Minimal structural view of the SDK we depend on — keeps it stubbable in tests. */
export interface GenAILike {
  models: {
    generateContent(args: {
      model: string;
      contents: unknown;
      config?: Record<string, unknown>;
    }): Promise<{
      text?: string;
      promptFeedback?: { blockReason?: string } | null;
    }>;
  };
}

export interface LLMClientOptions {
  model: string;
  maxTokens: number;
  /** Request timeout in seconds. */
  timeout: number;
  /** Thinking-token budget; 0 disables thinking (default). */
  thinkingBudget?: number;
}

/** Wraps a Gemini client and returns parsed JSON objects. */
export class LLMClient implements LLM {
  /** Public so tests can swap in a stub (mirrors the previous backend). */
  client: GenAILike;
  readonly model: string;
  readonly maxTokens: number;
  readonly thinkingBudget: number;

  constructor({ model, maxTokens, timeout, thinkingBudget }: LLMClientOptions) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    // httpOptions.timeout is in milliseconds.
    this.client = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: Math.round(timeout * 1000) },
    }) as unknown as GenAILike;
    this.model = model;
    this.maxTokens = maxTokens;
    this.thinkingBudget = thinkingBudget ?? 0;
  }

  /**
   * Call the model and return a JSON object conforming to `schema`.
   * Throws LLMError on any failure (network, safety block, bad JSON) so the
   * caller can fall back gracefully.
   */
  async structured({ system, user, schema }: StructuredArgs): Promise<Record<string, unknown>> {
    let response: { text?: string; promptFeedback?: { blockReason?: string } | null };
    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: user,
        config: {
          systemInstruction: system,
          maxOutputTokens: this.maxTokens,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          thinkingConfig: { thinkingBudget: this.thinkingBudget },
        },
      });
    } catch (err) {
      throw new LLMError(`LLM request failed: ${errMsg(err)}`);
    }

    // A safety block (or other non-STOP finish) yields no usable text.
    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new LLMError(`model blocked the request: ${blockReason}`);
    }

    const text = response.text;
    if (!text) {
      throw new LLMError("model returned no text content");
    }

    try {
      return JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
    } catch (err) {
      throw new LLMError(`model returned invalid JSON: ${errMsg(err)}`);
    }
  }
}

/** Tolerate models that wrap JSON in a ```json code fence. */
function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
