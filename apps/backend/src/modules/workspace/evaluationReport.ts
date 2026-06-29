/**
 * Map the canonical EvaluationResult (§6.9) onto the debrief the UI renders
 * (EvaluationReportDTO): a letter from the Learner, a notebook of what landed /
 * what's still fuzzy, and suggested next topics.
 *
 * The Evaluator's output can be sparse — offline (no Gemini key) it grades by
 * keyword coverage, and a free-form workspace has no curated key concepts — so
 * this mapper layers fallbacks: prefer the Evaluator's findings/strengths, then
 * the Learner's own mental model (open gaps, questions), then generic but
 * relevant lines. The debrief always renders something meaningful (§10).
 */

import type { EvaluationResult } from "../../contracts/evaluation.js";
import type { LearnerState } from "../../contracts/learner.js";
import type { EvaluationReport } from "../../contracts/workspace.js";

interface ReportContext {
  title: string;
  turnCount: number;
  learnerState?: LearnerState;
  /**
   * False when the deterministic offline evaluator graded without any reference
   * material or key concepts — its numeric score is then meaningless, so the
   * letter tone and reflection fall back to session engagement instead.
   */
  meaningfulScore?: boolean;
}

export function buildEvaluationReport(
  result: EvaluationResult,
  ctx: ReportContext,
): EvaluationReport {
  const topic = ctx.title?.trim() || "topik ini";
  const meaningful = ctx.meaningfulScore !== false;
  const tone = meaningful ? toneFromScore(result.score) : toneFromTurns(ctx.turnCount);

  const correct = result.findings.filter((f) => f.category === "CORRECT");
  const shaky = result.findings.filter((f) => f.category !== "CORRECT");

  // What landed: correct findings, then explicit strengths, then the Learner's
  // understood concepts — whichever we have.
  const learned = dedupe([
    ...correct.map((f) => f.detail || `Kamu menjelaskan ${f.concept} dengan baik`),
    ...result.strengths,
    ...(ctx.learnerState?.understoodConcepts ?? []).map(
      (c) => `Aku jadi paham soal ${c}`,
    ),
  ]).slice(0, 4);

  // What's still fuzzy: non-correct findings, then improvements, then the
  // Learner's open gaps and the questions it never got answered.
  const stillConfused = dedupe([
    ...shaky.map((f) => f.detail || `Bagian ${f.concept} masih belum nyangkut`),
    ...result.improvements,
    ...(ctx.learnerState?.openGaps ?? []),
    ...(ctx.learnerState?.questionsAsked ?? []),
  ]).slice(0, 4);

  const continueLearning = dedupe([
    ...result.improvements,
    ...shaky.map((f) => f.concept),
  ])
    .map((s) => cleanTopic(s, topic))
    .filter(Boolean)
    .slice(0, 3);

  return {
    letter: composeLetter(result, topic, tone),
    notebook: {
      learned: learned.length ? learned : fallbackLearned(ctx.turnCount),
      stillConfused: stillConfused.length
        ? stillConfused
        : fallbackConfused(ctx.turnCount),
      reflection: meaningful
        ? result.summary || fallbackReflection(ctx.turnCount)
        : fallbackReflection(ctx.turnCount),
    },
    continueLearning: continueLearning.length
      ? continueLearning
      : fallbackContinue(topic),
  };
}

// --- Letter ----------------------------------------------------------------

type Tone = "high" | "mid" | "low";

function toneFromScore(score: number): Tone {
  if (score >= 80) return "high";
  if (score >= 50) return "mid";
  return "low";
}

function toneFromTurns(turnCount: number): Tone {
  if (turnCount >= 3) return "high";
  if (turnCount >= 1) return "mid";
  return "low";
}

function composeLetter(result: EvaluationResult, topic: string, tone: Tone): string {
  const date = new Date().toISOString().slice(0, 10);
  const strength = result.strengths[0];
  const improvement = result.improvements[0];

  const opening = `Haii!\n\nMakasih banget udah ngajarin aku soal ${topic} tadi. Aku beneran berusaha ngikutin tiap penjelasanmu.`;

  let body: string;
  if (tone === "high") {
    body =
      "Jujur, kali ini banyak banget yang nyantol! Cara kamu nyusun penjelasannya runtut, jadi gampang aku bayangin gambaran besarnya.";
  } else if (tone === "mid") {
    body =
      "Lumayan banyak yang aku tangkap, walau ada beberapa bagian yang masih perlu aku ulang-ulang sendiri biar makin paham.";
  } else {
    body =
      "Aku nangkep arah besarnya, tapi jujur masih ada banyak yang belum sepenuhnya aku ngerti. Bukan salah kamu kok — aku cuma butuh diulang pelan-pelan.";
  }

  const praise = strength
    ? `\n\nYang paling ngebantu: ${lower(strength)}.`
    : "";
  const ask = improvement
    ? `\n\nKalau nanti kita lanjut lagi, boleh dong bahas ${lower(improvement)}? Aku penasaran banget.`
    : "\n\nKapan-kapan ajarin aku lagi ya, aku mau tau kelanjutannya!";

  const closing = `\n\nSampai ketemu lagi~\n— Learner-mu 🌱\n\n(${date})`;

  return `${opening}\n\n${body}${praise}${ask}${closing}`;
}

// --- Fallbacks -------------------------------------------------------------

function fallbackLearned(turnCount: number): string[] {
  if (turnCount === 0) return ["Pengenalan awal topik"];
  return [
    "Konsep utama yang kamu jelaskan di awal sesi",
    "Alur step-by-step yang kamu gambar di whiteboard",
    "Contoh konkret yang kamu kasih — itu yang paling bikin aku 'oh!'",
  ];
}

function fallbackConfused(turnCount: number): string[] {
  if (turnCount < 2) {
    return [
      "Koneksi antar konsep masih agak kabur buat aku",
      "Edge case-nya belum sempat kebahas",
    ];
  }
  return [
    "Detail di kasus-kasus khusus",
    "Kenapa pendekatan ini lebih baik dari alternatifnya",
    "Batasan / limitasi-nya masih bikin aku ragu",
  ];
}

function fallbackReflection(turnCount: number): string {
  if (turnCount === 0) {
    return "Sesi ini singkat banget, jadi belum banyak yang bisa aku serap. Lanjut lebih dalam di sesi berikutnya ya!";
  }
  return "Fondasi awalnya udah kena. Diagram di whiteboard sangat membantu — kalau sesinya lebih panjang aku yakin bisa nangkep lebih banyak.";
}

function fallbackContinue(topic: string): string[] {
  return [
    `${topic} — kasus lanjutan & edge case`,
    "Perbandingan dengan pendekatan alternatif",
    "Contoh penerapan di dunia nyata",
  ];
}

// --- Helpers ---------------------------------------------------------------

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw?.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function cleanTopic(s: string, topic: string): string {
  const t = s.trim().replace(/^Tambahkan penjelasan tentang:\s*/i, "");
  return t || topic;
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
