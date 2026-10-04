/**
 * Deterministic offline Evaluator (Architecture Document §3.7, §10 fallback).
 *
 * Used when no Gemini credential is configured (or USE_MOCK_AI=true), and as the
 * graceful fallback when a real evaluation call fails — so the debrief always
 * renders rather than dead-ending the flow. It scores by naive keyword coverage
 * of the topic's keyConcepts across the transcript -- board, speech, and what
 * the user typed in chat -- covered -> CORRECT, absent -> MISSED. No model
 * call, fully reproducible.
 */

import { utcNowIso } from "../../contracts/common.js";
import { scoreFindings } from "./scoring.js";
import type { EvaluationResult, Finding, EvaluatorInput, TranscriptTurn } from "./types.js";

const STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "from", "into", "are", "was", "were",
  "yang", "dan", "atau", "untuk", "dari", "pada", "adalah", "dengan", "ini",
  "itu", "tidak", "akan", "oleh", "sebagai", "dalam", "menjadi",
]);

/**
 * Every sentence this path writes, in both languages a session runs in. It is
 * also the fallback when a real evaluation fails, so an Indonesian session
 * that hit an error used to get its whole report in English.
 */
const COPY = {
  en: {
    covered: "This concept appears to be conveyed in your explanation.",
    missed: "This key concept wasn't touched on at all during the session.",
    missedFollowUp: (c: string) => `Next session, open with ${c} and walk through how it works before moving on.`,
    misconception: "Common misconception",
    misconceptionDetail: (b: string) => `Your explanation brushed against a common misconception: "${b}".`,
    misconceptionFollowUp: (b: string) =>
      `Check what the reference says about "${b}", then say the correct version out loud before you teach it again.`,
    nothing: "No teaching turns were recorded yet, so there's nothing to assess.",
    conveyed: (n: number, of: number) => `You conveyed ${n} of ${of} key concepts. `,
    someMissed: "A few important parts were still missed.",
    allCovered: "Concept coverage is complete, nice work!",
    strength: (c: string) => `Explained: ${c}`,
    improvement: (c: string) => `Add an explanation of: ${c}`,
  },
  id: {
    covered: "Konsep ini tampaknya sudah tersampaikan dalam penjelasanmu.",
    missed: "Konsep kunci ini sama sekali belum disentuh selama sesi.",
    missedFollowUp: (c: string) => `Di sesi berikutnya, buka dengan ${c} dan jelaskan cara kerjanya sebelum lanjut.`,
    misconception: "Miskonsepsi umum",
    misconceptionDetail: (b: string) => `Penjelasanmu menyinggung miskonsepsi yang umum: "${b}".`,
    misconceptionFollowUp: (b: string) =>
      `Cek apa kata referensi tentang "${b}", lalu ucapkan versi yang benar sebelum mengajarkannya lagi.`,
    nothing: "Belum ada giliran mengajar yang tercatat, jadi belum ada yang bisa dinilai.",
    conveyed: (n: number, of: number) => `Kamu menyampaikan ${n} dari ${of} konsep kunci. `,
    someMissed: "Masih ada beberapa bagian penting yang terlewat.",
    allCovered: "Semua konsep sudah tercakup, kerja bagus!",
    strength: (c: string) => `Sudah dijelaskan: ${c}`,
    improvement: (c: string) => `Tambahkan penjelasan tentang: ${c}`,
  },
};

export function mockEvaluator(input: EvaluatorInput, evaluationId: string): EvaluationResult {
  const copy = COPY[input.locale === "id" ? "id" : "en"];
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
        detail: copy.covered,
        evidenceTurnIndex,
      });
    } else {
      missed.push(concept);
      findings.push({
        category: "MISSED",
        concept,
        detail: copy.missed,
        evidenceTurnIndex: null,
        followUp: copy.missedFollowUp(concept),
      });
    }
  }

  // Keyword coverage can say whether a concept was mentioned, never how deeply
  // it was explained, so there is no honest offline measure of depth. What the
  // transcript does support is a volume proxy, capped at 50: non-zero once the
  // user actually wrote something, never high enough to pass for a judgement
  // the offline path did not make.
  const explained = input.turns
    .map((turn) => `${turn.boardText ?? ""} ${turn.speech ?? ""} ${taughtInChat(turn)}`.trim())
    .join(" ");
  const depthScore =
    input.turns.length === 0 ? 0 : Math.min(50, Math.round(explained.length / 20));

  // Watch for any common misconception surfacing verbatim in the transcript.
  for (const belief of input.commonMisconceptions) {
    const idx = findEvidenceTurn(input.turns, belief);
    if (idx !== null) {
      findings.push({
        category: "WRONG",
        concept: copy.misconception,
        detail: copy.misconceptionDetail(belief),
        evidenceTurnIndex: idx,
        followUp: copy.misconceptionFollowUp(belief),
      });
    }
  }

  // Same arithmetic the real path uses (scoring.ts), over findings this path
  // reached by keyword matching rather than by judgement. The number then means
  // the same thing in both modes even though the evidence behind it is weaker,
  // which is what makes an offline score comparable to an online one at all.
  const score = input.turns.length === 0 ? 0 : scoreFindings(findings).score;

  return {
    evaluationId,
    sessionId: input.sessionId,
    score,
    depthScore,
    findings,
    summary:
      input.turns.length === 0
        ? copy.nothing
        : copy.conveyed(covered.length, input.keyConcepts.length) +
          (missed.length ? copy.someMissed : copy.allCovered),
    strengths: covered.slice(0, 3).map(copy.strength),
    improvements: missed.slice(0, 3).map(copy.improvement),
    generatedAt: utcNowIso(),
  };
}

/**
 * This turn's chat, teacher's side only.
 *
 * The student's lines are excluded on purpose. They name the concept constantly
 * — asking about it is what a student does — so counting them would mark every
 * concept the student was curious about as one the user taught.
 */
function taughtInChat(turn: TranscriptTurn): string {
  return (turn.chat ?? [])
    .filter((message) => message.sender === "user")
    .map((message) => message.text)
    .join(" ");
}

/** First turn whose text shares a distinctive content word with the concept. */
function findEvidenceTurn(turns: TranscriptTurn[], concept: string): number | null {
  const words = contentWords(concept);
  if (words.length === 0) return null;
  for (const turn of turns) {
    const text = [turn.boardText, turn.speech, turn.learnerUtterance, taughtInChat(turn)]
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
