/**
 * Evaluator output guard (Architecture Document §3.7, §6.9).
 *
 * Normalizes the model's raw JSON into the canonical EvaluationResult: clamps the
 * scores to 0..100, drops findings with an unknown category, and coerces field
 * types. Mirrors the Learner/Vision/ASR guards so a slightly-off model response
 * never breaks the debrief.
 *
 * It also takes the transcript, because one field cannot be checked without it:
 * `sourceQuote` is only useful if it really occurs in the turn it points at.
 */

import { utcNowIso } from "../../contracts/common.js";
import type { FindingCategory } from "../../contracts/enums.js";
import type { EvaluationResult, Finding, TranscriptTurn } from "./types.js";

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
  turns: TranscriptTurn[] = [],
): EvaluationResult {
  return {
    evaluationId,
    sessionId,
    score: clampScore(raw.score),
    depthScore: clampScore(raw.depthScore),
    findings: normalizeFindings(raw.findings, turns),
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

function normalizeFindings(value: unknown, turns: TranscriptTurn[]): Finding[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => coerceFinding(item, turns))
    .filter((f): f is Finding => f !== null);
}

function coerceFinding(value: unknown, turns: TranscriptTurn[]): Finding | null {
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

  const finding: Finding = {
    category: category as FindingCategory,
    concept,
    detail,
    evidenceTurnIndex,
  };

  const quote = resolveSourceQuote(f.sourceQuote, evidenceTurnIndex, turns);
  if (quote) finding.sourceQuote = quote;

  // Kept even on a CORRECT finding if the model volunteered one: the prompt asks
  // it to stay quiet there, but advice that arrived anyway is still advice, and
  // dropping it silently would be a surprise the UI cannot explain.
  const followUp = typeof f.followUp === "string" ? f.followUp.trim() : "";
  if (followUp) finding.followUp = followUp;

  return finding;
}

/**
 * Accept a sourceQuote only when the evidence turn actually contains it.
 *
 * The prompt asks for a verbatim substring so the debrief can highlight the one
 * sentence a finding rests on. Models paraphrase anyway, and a quote that is not
 * in the text highlights nothing: the UI searches, finds no match, and shows no
 * indication that anything went wrong. Verifying here turns that silent failure
 * into a visible one place earlier.
 *
 * A rejected quote does not take the finding with it. The judgement is still
 * sound without a precise anchor, and the UI falls back to highlighting the
 * whole turn.
 *
 * The match returns the source's own slice rather than the model's rendering of
 * it, so whatever the UI searches for is guaranteed to be found.
 */
function resolveSourceQuote(
  value: unknown,
  evidenceTurnIndex: number | null,
  turns: TranscriptTurn[],
): string | undefined {
  if (typeof value !== "string") return undefined;
  const quote = value.trim();
  if (!quote || evidenceTurnIndex === null) return undefined;

  const turn = turns.find((t) => t.turnIndex === evidenceTurnIndex);
  if (!turn) return undefined;

  return findVerbatim(turn.boardText, quote) ?? findVerbatim(turn.speech, quote);
}

/**
 * Locate `needle` in `haystack`, tolerating the two ways a model rewrites a
 * quote without changing its words: different runs of whitespace (the board
 * text arrives with newlines the model flattens) and different capitalization
 * at a sentence boundary. Anything beyond that is a paraphrase, not a quote.
 */
function findVerbatim(haystack: string | undefined, needle: string): string | undefined {
  if (!haystack) return undefined;
  if (haystack.includes(needle)) return needle;

  const flatHaystack = collapse(haystack);
  const flatNeedle = collapse(needle);
  if (!flatNeedle.text) return undefined;

  const at = flatHaystack.text.indexOf(flatNeedle.text);
  if (at < 0) return undefined;

  // Map the match back through the offset table to slice the original text.
  const start = flatHaystack.offsets[at];
  const end = flatHaystack.offsets[at + flatNeedle.text.length - 1] + 1;
  return haystack.slice(start, end);
}

/**
 * Lowercase `s` with each run of whitespace squeezed to one space, alongside the
 * index in the original string that every surviving character came from.
 */
function collapse(s: string): { text: string; offsets: number[] } {
  let text = "";
  const offsets: number[] = [];
  let gap = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      gap = text.length > 0;
      continue;
    }
    if (gap) {
      text += " ";
      offsets.push(i);
      gap = false;
    }
    text += ch.toLowerCase();
    offsets.push(i);
  }
  return { text, offsets };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}
