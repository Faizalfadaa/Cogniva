/**
 * Deterministic offline Evaluator (Architecture Document §3.7, §10 fallback).
 *
 * Used when no Gemini credential is configured (or USE_MOCK_AI=true), and as the
 * graceful fallback when a real evaluation call fails — so the debrief always
 * renders rather than dead-ending the flow. It scores by naive keyword coverage
 * of the topic's keyConcepts across the transcript: covered -> CORRECT, absent
 * -> MISSED. No model call, fully reproducible.
 */

import { utcNowIso } from "../../contracts/common.js";
import type { EvaluationResult, Finding, EvaluatorInput, TranscriptTurn } from "./types.js";

const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "from", "into", "are", "was", "were",
  "yang", "dan", "atau", "untuk", "dari", "pada", "adalah", "dengan", "ini",
  "itu", "tidak", "akan", "oleh", "sebagai", "dalam", "menjadi",
]);

export function mockEvaluator(input: EvaluatorInput, evaluationId: string): EvaluationResult {
  const findings: Finding[] = [];
  const covered: string[] = [];
  const missed: string[] = [];

  for (const concept of input.keyConcepts) {
    const evidenceTurnIndex = findEvidenceTurn(input.turns, concept);
    if (evidenceTurnIndex !== null) {
      covered.push(concept);
      findings.push({
        category: "CORRECT",
        concept,
        detail: "This concept appears to be conveyed in your explanation.",
        evidenceTurnIndex,
      });
    } else {
      missed.push(concept);
      findings.push({
        category: "MISSED",
        concept,
        detail: "This key concept wasn't touched on at all during the session.",
        evidenceTurnIndex: null,
      });
    }
  }

  const total = input.keyConcepts.length || 1;
  const score = input.turns.length === 0 ? 0 : Math.round((covered.length / total) * 100);

  // Watch for any common misconception surfacing verbatim in the transcript.
  for (const belief of input.commonMisconceptions) {
    const idx = findEvidenceTurn(input.turns, belief);
    if (idx !== null) {
      findings.push({
        category: "WRONG",
        concept: "Common misconception",
        detail: `Your explanation brushed against a common misconception: "${belief}".`,
        evidenceTurnIndex: idx,
      });
    }
  }

  return {
    evaluationId,
    sessionId: input.sessionId,
    score,
    findings,
    summary:
      input.turns.length === 0
        ? "No teaching turns were recorded yet, so there's nothing to assess."
        : `You conveyed ${covered.length} of ${total} key concepts. ` +
          (missed.length
            ? "A few important parts were still missed."
            : "Concept coverage is complete, nice work!"),
    strengths: covered.slice(0, 3).map((c) => `Explained: ${c}`),
    improvements: missed.slice(0, 3).map((c) => `Add an explanation of: ${c}`),
    generatedAt: utcNowIso(),
  };
}

/** First turn whose text shares a distinctive content word with the concept. */
function findEvidenceTurn(turns: TranscriptTurn[], concept: string): number | null {
  const words = contentWords(concept);
  if (words.length === 0) return null;
  for (const turn of turns) {
    const text = [turn.boardText, turn.speech, turn.learnerUtterance]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (words.some((w) => text.includes(w))) return turn.turnIndex;
  }
  return null;
}

function contentWords(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
}
