/**
 * Regression: two concurrent POST /evaluate for the same round must not race.
 *
 * The debrief screen evaluates on mount; React StrictMode (dev) mounts it twice,
 * firing /evaluate twice. With a slow Evaluator both overlap while the session is
 * still ENDED — the loser used to 409 on the state transition ("Invalid
 * transition: evaluate in EVALUATED") and surface as "Gagal memuat penilaian".
 */

import { afterEach, describe, expect, it } from "vitest";

import { setEvaluator, type EvaluatorInput } from "../src/agents/evaluator/index.js";
import type { EvaluatorAgent } from "../src/agents/evaluator/index.js";
import { buildApp } from "../src/app.js";

// Deliberately slow so the two concurrent calls actually overlap.
const slowEvaluator = {
  async evaluate(input: EvaluatorInput, evaluationId: string) {
    await new Promise((r) => setTimeout(r, 40));
    return {
      evaluationId,
      sessionId: input.sessionId,
      score: 50,
      findings: [],
      summary: "ok",
      strengths: [],
      improvements: [],
      generatedAt: new Date().toISOString(),
    };
  },
} as unknown as EvaluatorAgent;

describe("POST /evaluate concurrency", () => {
  afterEach(() => setEvaluator(null));

  it("dedupes overlapping evaluate calls (no 409, single history entry)", async () => {
    setEvaluator(slowEvaluator);
    const app = await buildApp();

    const created = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { topicId: "topic_photosynthesis" },
    });
    const id = created.json().sessionId as string;
    await app.inject({ method: "POST", url: `/api/sessions/${id}/start` });
    await app.inject({ method: "POST", url: `/api/sessions/${id}/end` });

    const [a, b] = await Promise.all([
      app.inject({ method: "POST", url: `/api/sessions/${id}/evaluate` }),
      app.inject({ method: "POST", url: `/api/sessions/${id}/evaluate` }),
    ]);

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(a.json().evaluationId).toBe(b.json().evaluationId);

    const hist = await app.inject({ method: "GET", url: `/api/sessions/${id}/evaluations` });
    expect(hist.json()).toHaveLength(1);

    await app.close();
  });
});
