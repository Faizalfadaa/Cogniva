/**
 * Evaluator output guard (Architecture Document §3.7, §6.9).
 *
 * Normalizes the model's raw JSON into the canonical EvaluationResult: clamps the
 * score to 0..100, drops findings with an unknown category, and coerces field
 * types. Mirrors the Learner/Vision/ASR guards so a slightly-off model response
 * never breaks the debrief.
 */

import { utcNowIso } from "../../contracts/common.js";
import type { FindingCategory } from "../../contracts/enums.js";
import type { EvaluationResult, Finding } from "./types.js";

const ALLOWED_CATEGORIES: readonly FindingCategory[] = [
  "CORRECT",
  "WRONG",
  "MISSED",
  "CONFUSING",
];

export function normalizeEvaluation(
  raw: Record<string, unknown>,
  sessionId: string,
  evaluationId: string,
): EvaluationResult {
  return {
    evaluationId,
    sessionId,
    score: clampScore(raw.score),
    findings: normalizeFindings(raw.findings),
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    strengths: normalizeStringArray(raw.strengths),
    improvements: normalizeStringArray(raw.improvements),
    generatedAt: utcNowIso(),
  };
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeFindings(value: unknown): Finding[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(coerceFinding)
    .filter((f): f is Finding => f !== null);
}

function coerceFinding(value: unknown): Finding | null {
  if (!value || typeof value !== "object") return null;
  const f = value as Record<string, unknown>;
  const category = f.category;
  if (typeof category !== "string" || !ALLOWED_CATEGORIES.includes(category as FindingCategory)) {
    return null;
  }
  const concept = typeof f.concept === "string" ? f.concept.trim() : "";
  const detail = typeof f.detail === "string" ? f.detail.trim() : "";
  if (!concept && !detail) return null;

  const idx = f.evidenceTurnIndex;
  const evidenceTurnIndex =
    typeof idx === "number" && Number.isFinite(idx) ? Math.trunc(idx) : null;

  return {
    category: category as FindingCategory,
    concept,
    detail,
    evidenceTurnIndex,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}
