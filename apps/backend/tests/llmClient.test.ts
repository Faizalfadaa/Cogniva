/**
 * LLMClient parsing tests (Architecture Document §3.3, §7.3).
 *
 * The real Gemini call needs a key and is exercised in integration; here we
 * stub the inner SDK client to lock the request shape and response parsing —
 * including structured-output JSON, safety blocks, and malformed output.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { LLMClient, LLMError, isTransientLLMError, type GenAILike } from "../src/llm/index.js";

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

/** A stub that throws `failures` errors in a row, then answers. */
function flaky(failures: unknown[], calls: string[]): GenAILike {
  return {
    models: {
      async generateContent(args) {
        calls.push(args.model);
        const err = failures.shift();
        if (err) throw err;
        return { text: '{"ok": true}' };
      },
    },
  };
}

function overloaded(): Error {
  return Object.assign(new Error("The model is overloaded. Please try again later."), {
    status: 503,
  });
}

describe("LLMClient retries", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key-not-used";
    delete process.env.COGNIVA_FALLBACK_MODEL;
  });

  function retryingClient(model = "gemini-3.5-flash"): LLMClient {
    const client = new LLMClient({ model, maxTokens: 128, timeout: 5 });
    client.sleep = async () => {};
    return client;
  }

  it("retries a 503 on the same model and succeeds", async () => {
    const client = retryingClient();
    const calls: string[] = [];
    client.client = flaky([overloaded(), overloaded()], calls);

    const out = await client.structured({ system: "s", user: "u", schema: {} });

    expect(out).toEqual({ ok: true });
    expect(calls).toEqual(["gemini-3.5-flash", "gemini-3.5-flash", "gemini-3.5-flash"]);
  });

  it("moves to the fallback model when the primary stays overloaded", async () => {
    const client = retryingClient();
    const calls: string[] = [];
    client.client = flaky([overloaded(), overloaded(), overloaded()], calls);

    const out = await client.structured({ system: "s", user: "u", schema: {} });

    expect(out).toEqual({ ok: true });
    expect(calls.at(-1)).toBe("gemini-2.5-flash");
  });

  it("gives up with an LLMError after every attempt fails", async () => {
    const client = retryingClient();
    const calls: string[] = [];
    client.client = flaky(Array.from({ length: 10 }, overloaded), calls);

    await expect(
      client.structured({ system: "s", user: "u", schema: {} }),
    ).rejects.toBeInstanceOf(LLMError);
    expect(calls).toHaveLength(5);
  });

  it("does not retry a non-transient error", async () => {
    const client = retryingClient();
    const calls: string[] = [];
    const badRequest = Object.assign(new Error("invalid argument"), { status: 400 });
    client.client = flaky([badRequest], calls);

    await expect(
      client.structured({ system: "s", user: "u", schema: {} }),
    ).rejects.toBeInstanceOf(LLMError);
    expect(calls).toHaveLength(1);
  });

  it("picks a fallback different from the primary", () => {
    expect(retryingClient("gemini-2.5-flash").fallbackModel).toBe("gemini-3.5-flash");
    process.env.COGNIVA_FALLBACK_MODEL = "gemini-2.0-flash";
    expect(retryingClient().fallbackModel).toBe("gemini-2.0-flash");
  });

  it("recognises overload errors that carry no status field", () => {
    expect(isTransientLLMError(new Error('got status: 503 UNAVAILABLE'))).toBe(true);
    expect(isTransientLLMError(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
    expect(isTransientLLMError(new Error("request timed out"))).toBe(false);
  });
});
