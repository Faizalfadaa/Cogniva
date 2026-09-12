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
  /** Optional image part for multimodal agents (Vision, §3.4). Omitted by
   * text-only agents (Learner, Evaluator) -- adding this field does not
   * change their call shape or behavior. */
  image?: { data: string; mimeType: string };
  /** Optional audio part for the ASR agent (§3.5). Same additive shape as
   * `image`: text-only agents omit it and are unaffected. */
  audio?: { data: string; mimeType: string };
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
      /** Token accounting for the call. Every field is optional in the SDK, so
       * callers must treat a missing count as zero. */
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
      /** Present only on tool-assisted calls; see LLMClient.grounded(). */
      candidates?: Array<{
        groundingMetadata?: {
          groundingChunks?: Array<{ web?: { title?: string; uri?: string; domain?: string } }>;
        };
        urlContextMetadata?: {
          urlMetadata?: Array<{ retrievedUrl?: string; urlRetrievalStatus?: string }>;
        };
      }>;
    }>;
    /**
     * Optional so a stub that only implements generateContent still satisfies
     * this interface — only EmbeddingClient needs it.
     */
    embedContent?(args: {
      model: string;
      contents: string[];
      config?: Record<string, unknown>;
    }): Promise<{ embeddings?: Array<{ values?: number[] }> }>;
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
  /**
   * Token cost of the most recent successful structured() call, or null if no
   * call has landed yet. Reported out-of-band rather than through the return
   * value so every existing caller keeps its current signature (§7.3).
   */
  lastUsage: { inputTokens: number; outputTokens: number } | null = null;
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
  async structured({ system, user, schema, image, audio }: StructuredArgs): Promise<Record<string, unknown>> {
    let response: Awaited<ReturnType<GenAILike["models"]["generateContent"]>>;
    try {
      // Text-only agents (Learner, Evaluator) keep passing `user` as a plain
      // string, unchanged. Multimodal agents attach inline-data parts -- Vision
      // an image (§3.4), ASR an audio clip (§3.5) -- riding the same seam.
      // `data` here is the base64 string itself, per the SDK's Blob shape.
      const mediaParts = [image, audio]
        .filter((m): m is { data: string; mimeType: string } => Boolean(m))
        .map((m) => ({ inlineData: { data: m.data, mimeType: m.mimeType } }));

      const contents = mediaParts.length
        ? [{ role: "user", parts: [...mediaParts, { text: user }] }]
        : user;

      response = await this.client.models.generateContent({
        model: this.model,
        contents,
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

    // Record usage the moment the call returns, BEFORE the block check and the
    // JSON parse below: those tokens were spent and billed no matter how
    // unusable the payload turns out to be.
    this.lastUsage = {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };

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

  /**
   * Call the model with a grounding tool and return prose plus the sources it
   * consulted.
   *
   * Deliberately NOT structured output: Gemini rejects the combination outright
   * with "Tool use with a response mime type: 'application/json' is
   * unsupported". So grounded calls return prose, and a caller that needs JSON
   * runs a second, tool-free structured() pass over this text. Two calls, both
   * in a mode the API actually supports.
   */
  async grounded({ system, user, mode }: GroundedArgs): Promise<GroundedResult> {
    let response: Awaited<ReturnType<GenAILike["models"]["generateContent"]>>;
    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: user,
        config: {
          systemInstruction: system,
          maxOutputTokens: this.maxTokens,
          tools: [mode === "search" ? { googleSearch: {} } : { urlContext: {} }],
          thinkingConfig: { thinkingBudget: this.thinkingBudget },
        },
      });
    } catch (err) {
      throw new LLMError(`grounded request failed: ${errMsg(err)}`);
    }

    this.lastUsage = {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) throw new LLMError(`model blocked the request: ${blockReason}`);

    // Empty text is NOT an error here, unlike structured(). A grounding tool can
    // fetch a page and then return no candidate at all — a JS-only page, or one
    // the model declines to write about. The caller has the retrieval metadata
    // below and can tell the user which of those happened; throwing would erase
    // exactly the information that makes the failure explainable.
    const text = response.text ?? "";

    const candidate = response.candidates?.[0];
    const sources: GroundedSource[] = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .map((chunk) => ({
        title: chunk.web?.title ?? chunk.web?.domain ?? "",
        uri: chunk.web?.uri ?? "",
      }))
      .filter((source) => source.uri !== "");

    const retrieved = (candidate?.urlContextMetadata?.urlMetadata ?? []).map((entry) => ({
      url: entry.retrievedUrl ?? "",
      ok: entry.urlRetrievalStatus === "URL_RETRIEVAL_STATUS_SUCCESS",
    }));

    return { text, sources, retrieved };
  }
}

/** A source the model actually consulted, as reported by Gemini. */
export interface GroundedSource {
  title: string;
  uri: string;
}

export interface GroundedArgs {
  system: string;
  user: string;
  /**
   * `search` lets the model run Google Search; `url` lets it fetch pages the
   * prompt names. Both return real, checkable sources — which is the whole
   * point: a model asked for references from memory invents plausible URLs.
   */
  mode: "search" | "url";
}

export interface GroundedResult {
  /** May be empty — see the note in `grounded()`. */
  text: string;
  sources: GroundedSource[];
  /** URLs the model was asked to read, and whether the fetch actually worked. */
  retrieved: Array<{ url: string; ok: boolean }>;
}

/** What an embedding call is for. Gemini tunes the vector to the task. */
export type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface EmbedArgs {
  texts: string[];
  /** Defaults to RETRIEVAL_DOCUMENT (indexing). Use RETRIEVAL_QUERY to search. */
  taskType?: EmbeddingTask;
}

/**
 * The embedding seam, mirroring `LLM`. Retrieval depends on this interface
 * rather than the concrete client, so tests can index without a network call.
 */
export interface Embedder {
  embed(args: EmbedArgs): Promise<number[][]>;
}

export interface EmbeddingClientOptions {
  model: string;
  /** Requested vector size; the model's native output is truncated to it. */
  dimensions: number;
  /** Request timeout in seconds. */
  timeout: number;
  /** Texts per request. */
  batchSize: number;
}

/**
 * Wraps Gemini's embedContent for the reference index (§3.7 retrieval).
 *
 * Two details matter for correctness. First, documents and queries must be
 * embedded with different task types — that is what makes a short query land
 * near the long passage that answers it. Second, a truncated vector (any
 * `dimensions` below the model's native size) is not unit-length, so it is
 * re-normalized here; afterwards cosine similarity is just a dot product.
 */
export class EmbeddingClient implements Embedder {
  /** Public so tests can swap in a stub, mirroring LLMClient. */
  client: GenAILike;
  readonly model: string;
  readonly dimensions: number;
  readonly batchSize: number;

  constructor({ model, dimensions, timeout, batchSize }: EmbeddingClientOptions) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    this.client = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: Math.round(timeout * 1000) },
    }) as unknown as GenAILike;
    this.model = model;
    this.dimensions = dimensions;
    this.batchSize = Math.max(1, batchSize);
  }

  /** Embed texts in order. Throws LLMError so callers can fall back. */
  async embed({ texts, taskType = "RETRIEVAL_DOCUMENT" }: EmbedArgs): Promise<number[][]> {
    if (texts.length === 0) return [];

    const embedContent = this.client.models.embedContent;
    if (!embedContent) {
      throw new LLMError("embedding is not supported by this client");
    }

    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      let response: { embeddings?: Array<{ values?: number[] }> };
      try {
        response = await embedContent.call(this.client.models, {
          model: this.model,
          contents: batch,
          config: { taskType, outputDimensionality: this.dimensions },
        });
      } catch (err) {
        throw new LLMError(`embedding request failed: ${errMsg(err)}`);
      }

      const embeddings = response.embeddings ?? [];
      if (embeddings.length !== batch.length) {
        throw new LLMError(
          `embedding count mismatch: asked ${batch.length}, got ${embeddings.length}`,
        );
      }
      for (const embedding of embeddings) {
        const values = embedding.values;
        if (!values || values.length === 0) {
          throw new LLMError("embedding response contained an empty vector");
        }
        vectors.push(normalize(values));
      }
    }
    return vectors;
  }
}

/** Scale a vector to unit length so cosine similarity becomes a dot product. */
export function normalize(values: number[]): number[] {
  let sum = 0;
  for (const v of values) sum += v * v;
  const length = Math.sqrt(sum);
  return length > 0 ? values.map((v) => v / length) : values.slice();
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
