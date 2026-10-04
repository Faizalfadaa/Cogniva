/**
 * LLMClient parsing tests (Architecture Document §3.3, §7.3).
 *
 * The real Gemini call needs a key and is exercised in integration; here we
 * stub the inner SDK client to lock the request shape and response parsing —
 * including structured-output JSON, safety blocks, and malformed output.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { LLMClient, LLMError, type GenAILike } from "../src/llm/index.js";

interface StubResponse {
  text?: string;
  promptFeedback?: { blockReason?: string } | null;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

function stub(response: StubResponse, capture: { args?: unknown } = {}): GenAILike {
  return {
    models: {
      async generateContent(args) {
        capture.args = args;
        return response;
      },
    },
  };
}

function makeClient(): LLMClient {
  process.env.GEMINI_API_KEY = "test-key-not-used";
  return new LLMClient({ model: "gemini-2.5-flash", maxTokens: 128, timeout: 5 });
}

describe("LLMClient.structured", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key-not-used";
  });

  it("parses JSON and sends the schema", async () => {
    const client = makeClient();
    const capture: { args?: any } = {};
    client.client = stub({ text: '{"answer": 42}' }, capture);

    const out = await client.structured({
      system: "sys",
      user: "usr",
      schema: { type: "object" },
    });

    expect(out).toEqual({ answer: 42 });
    expect(capture.args.model).toBe("gemini-2.5-flash");
    expect(capture.args.contents).toBe("usr");
    expect(capture.args.config.systemInstruction).toBe("sys");
    expect(capture.args.config.maxOutputTokens).toBe(128);
    expect(capture.args.config.responseMimeType).toBe("application/json");
    expect(capture.args.config.responseJsonSchema).toEqual({ type: "object" });
  });

  it("records the call's token usage on lastUsage", async () => {
    const client = makeClient();
    expect(client.lastUsage).toBeNull();
    client.client = stub({
      text: '{"answer": 42}',
      usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 340 },
    });

    await client.structured({ system: "s", user: "u", schema: {} });

    expect(client.lastUsage).toEqual({ inputTokens: 1200, outputTokens: 340 });
  });

  it("treats a response with no usageMetadata as zero, not a crash", async () => {
    const client = makeClient();
    client.client = stub({ text: '{"answer": 42}' });

    await client.structured({ system: "s", user: "u", schema: {} });

    expect(client.lastUsage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("still records usage when the payload is unusable — those tokens were spent", async () => {
    const client = makeClient();
    client.client = stub({
      text: "not json at all",
      usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 10 },
    });

    await expect(
      client.structured({ system: "s", user: "u", schema: {} }),
    ).rejects.toBeInstanceOf(LLMError);

    expect(client.lastUsage).toEqual({ inputTokens: 90, outputTokens: 10 });
  });

  it("raises on a safety block", async () => {
    const client = makeClient();
    client.client = stub({ promptFeedback: { blockReason: "SAFETY" } });
    await expect(
      client.structured({ system: "s", user: "u", schema: {} }),
    ).rejects.toBeInstanceOf(LLMError);
  });

  it("raises on malformed JSON", async () => {
    const client = makeClient();
    client.client = stub({ text: "not json at all" });
    await expect(
      client.structured({ system: "s", user: "u", schema: {} }),
    ).rejects.toBeInstanceOf(LLMError);
  });
});
