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
 *
 * The narrative is a summary of the evaluation, not a replacement for it. The
 * scores, the categorized findings and the cited turns are passed through
 * untouched alongside it, so the screen can show the breakdown the letter
 * necessarily glosses over.
 *
 * Everything this file writes itself is in the session's language, because the
 * language picker promises "the report comes back in it".
 */

import type { EvaluationResult } from "../../contracts/evaluation.js";
import type { LearnerState } from "../../contracts/learner.js";
import type {
  EvaluationTranscriptTurn,
  Locale,
  NewEvaluationReport,
} from "../../contracts/workspace.js";

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
  /**
   * The turns the findings cite. Absent on the failure path, which reports
   * without having read a transcript.
   */
  transcript?: EvaluationTranscriptTurn[];
  /**
   * The session's language. The letter, the notebook and every fallback are
   * written in it; absent outside a workspace, where they stay English.
   */
  locale?: Locale;
  /**
   * Whether the session had reference material when it was evaluated. Without
   * it the Evaluator had nothing to check against, and the debrief says so.
   */
  hadReference?: boolean;
}

export function buildEvaluationReport(
  result: EvaluationResult,
  ctx: ReportContext,
): NewEvaluationReport {
  const copy = COPY[ctx.locale === "id" ? "id" : "en"];
  const topic = ctx.title?.trim() || copy.thisTopic;
  const meaningful = ctx.meaningfulScore !== false;
  const tone = meaningful ? toneFromScore(result.score) : toneFromTurns(ctx.turnCount);

  const correct = result.findings.filter((f) => f.category === "CORRECT");
  const shaky = result.findings.filter((f) => f.category !== "CORRECT");

  // What landed: correct findings, then explicit strengths, then the Learner's
  // understood concepts — whichever we have.
  const learned = dedupe([
    ...correct.map((f) => f.detail || copy.explainedWell(f.concept)),
    ...result.strengths,
    ...(ctx.learnerState?.understoodConcepts ?? []).map(copy.finallyGet),
  ]).slice(0, 4);

  // What's still fuzzy: non-correct findings, then improvements, then the
  // Learner's open gaps and the questions it never got answered.
  const stillConfused = dedupe([
    ...shaky.map((f) => f.detail || copy.didntClick(f.concept)),
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
    letter: composeLetter(result, topic, tone, copy),
    notebook: {
      learned: learned.length ? learned : copy.fallbackLearned(ctx.turnCount),
      stillConfused: stillConfused.length
        ? stillConfused
        : copy.fallbackConfused(ctx.turnCount),
      reflection: meaningful
        ? result.summary || copy.fallbackReflection(ctx.turnCount)
        : copy.fallbackReflection(ctx.turnCount),
    },
    continueLearning: continueLearning.length
      ? continueLearning
      : copy.fallbackContinue(topic),
    score: result.score,
    depthScore: result.depthScore,
    findings: result.findings,
    transcript: ctx.transcript ?? [],
    ...(ctx.hadReference === undefined ? {} : { hadReference: ctx.hadReference }),
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

/**
 * The letter from the student.
 *
 * The strength and the improvement are the Evaluator's own sentences, spliced
 * in. They used to go in mid-sentence ("could we go over <improvement>?"),
 * which broke whenever the Evaluator wrote a full sentence, as it does: the
 * letter read "could we go over the user could provide more detail on...?",
 * and a sentence already ending in a period got a second one. Each is now set
 * after a colon, with its own closing punctuation trimmed and its own capital
 * kept, so any sentence the Evaluator writes reads as a quote. (Lowering the
 * first letter turned names and "Anda" into "naruto" and "anda".)
 */
function composeLetter(result: EvaluationResult, topic: string, tone: Tone, copy: Copy): string {
  const date = new Date().toISOString().slice(0, 10);
  const strength = result.strengths[0];
  const improvement = result.improvements[0];

  const praise = strength ? `\n\n${copy.letter.praise(trimEnd(strength))}` : "";
  const ask = improvement
    ? `\n\n${copy.letter.ask(trimEnd(improvement))}`
    : `\n\n${copy.letter.again}`;

  return `${copy.letter.opening(topic)}\n\n${copy.letter.body[tone]}${praise}${ask}${copy.letter.closing(date)}`;
}

// --- Copy ------------------------------------------------------------------

interface Copy {
  thisTopic: string;
  explainedWell: (concept: string) => string;
  finallyGet: (concept: string) => string;
  didntClick: (concept: string) => string;
  /** The offline evaluator's label on an improvement, stripped for "keep learning". */
  addExplanationPrefix: RegExp;
  letter: {
    opening: (topic: string) => string;
    body: Record<Tone, string>;
    praise: (strength: string) => string;
    ask: (improvement: string) => string;
    again: string;
    closing: (date: string) => string;
  };
  fallbackLearned: (turnCount: number) => string[];
  fallbackConfused: (turnCount: number) => string[];
  fallbackReflection: (turnCount: number) => string;
  fallbackContinue: (topic: string) => string[];
}

/** Every sentence the report writes itself, in both languages a session runs in. */
const COPY: Record<"en" | "id", Copy> = {
  en: {
    thisTopic: "this topic",
    explainedWell: (c) => `You explained ${c} well`,
    finallyGet: (c) => `I finally get ${c}`,
    didntClick: (c) => `The part about ${c} didn't quite click`,
    addExplanationPrefix: /^Add an explanation of:\s*/i,
    letter: {
      opening: (topic) =>
        `Hi!\n\nThank you so much for teaching me about ${topic} earlier. I really tried to follow every part of your explanation.`,
      body: {
        high: "Honestly, so much clicked this time! The way you laid it out was easy to follow, so I could picture the big picture.",
        mid: "I caught a fair amount, though there are a few parts I still need to go over again on my own to really get them.",
        low: "I got the general direction, but honestly there's still a lot I don't fully understand yet. It's not your fault, I just need it broken down slowly.",
      },
      praise: (s) => `What helped me the most: ${s}.`,
      ask: (s) => `One thing I'd love to go over next time: ${s}. I'm really curious about it.`,
      again: "Teach me again sometime, okay? I want to know what comes next!",
      closing: (date) => `\n\nSee you again~\n— Your learner 🌱\n\n(${date})`,
    },
    fallbackLearned: (turnCount) =>
      turnCount === 0
        ? ["A first introduction to the topic"]
        : [
            "The main concept you explained early in the session",
            "The step-by-step flow you drew on the whiteboard",
            "The concrete example you gave, that's what made it click for me",
          ],
    fallbackConfused: (turnCount) =>
      turnCount < 2
        ? ["The connection between the concepts is still a bit fuzzy for me", "We didn't get to the edge cases yet"]
        : [
            "The details in special cases",
            "Why this approach is better than the alternatives",
            "I'm still unsure about its limits",
          ],
    fallbackReflection: (turnCount) =>
      turnCount === 0
        ? "This session was really short, so I couldn't absorb much yet. Let's go deeper next time!"
        : "The foundation is there. The whiteboard diagrams helped a lot, and with a longer session I'm sure I could catch even more.",
    fallbackContinue: (topic) => [
      `${topic}: advanced cases and edge cases`,
      "Comparison with alternative approaches",
      "Real-world application examples",
    ],
  },
  id: {
    thisTopic: "topik ini",
    explainedWell: (c) => `Kamu menjelaskan ${c} dengan baik`,
    finallyGet: (c) => `Akhirnya aku paham ${c}`,
    didntClick: (c) => `Bagian tentang ${c} belum terlalu nyambung buatku`,
    addExplanationPrefix: /^Tambahkan penjelasan tentang:\s*/i,
    letter: {
      opening: (topic) =>
        `Hai!\n\nMakasih banyak ya udah ngajarin aku tentang ${topic} tadi. Aku beneran berusaha ngikutin setiap bagian penjelasanmu.`,
      body: {
        high: "Jujur, banyak banget yang nyambung kali ini! Caramu menjelaskan gampang diikuti, jadi aku bisa kebayang gambaran besarnya.",
        mid: "Lumayan banyak yang aku tangkap, walaupun masih ada beberapa bagian yang perlu aku pelajari ulang sendiri biar benar-benar paham.",
        low: "Arah besarnya aku dapat, tapi jujur masih banyak yang belum aku pahami. Bukan salahmu kok, aku cuma butuh penjelasan pelan-pelan.",
      },
      praise: (s) => `Yang paling membantu aku: ${s}.`,
      ask: (s) => `Satu hal yang pengin aku bahas lagi lain kali: ${s}. Aku penasaran banget.`,
      again: "Ajarin aku lagi kapan-kapan ya? Aku pengin tahu lanjutannya!",
      closing: (date) => `\n\nSampai ketemu lagi~\n— Muridmu 🌱\n\n(${date})`,
    },
    fallbackLearned: (turnCount) =>
      turnCount === 0
        ? ["Perkenalan pertama dengan topiknya"]
        : [
            "Konsep utama yang kamu jelaskan di awal sesi",
            "Alur langkah demi langkah yang kamu gambar di papan",
            "Contoh konkret yang kamu kasih, itu yang bikin aku paham",
          ],
    fallbackConfused: (turnCount) =>
      turnCount < 2
        ? ["Hubungan antar konsepnya masih agak samar buatku", "Kita belum sampai ke kasus-kasus khusus"]
        : [
            "Detail di kasus-kasus khusus",
            "Kenapa cara ini lebih baik daripada alternatifnya",
            "Aku masih belum yakin batasannya sampai mana",
          ],
    fallbackReflection: (turnCount) =>
      turnCount === 0
        ? "Sesi ini singkat banget, jadi belum banyak yang bisa aku serap. Lain kali kita bahas lebih dalam ya!"
        : "Dasarnya sudah ada. Gambar di papan sangat membantu, dan dengan sesi yang lebih panjang aku yakin bisa menangkap lebih banyak lagi.",
    fallbackContinue: (topic) => [
      `${topic}: kasus lanjutan dan kasus khusus`,
      "Perbandingan dengan pendekatan lain",
      "Contoh penerapan di dunia nyata",
    ],
  },
};

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

/** An improvement as a topic to keep learning, without the offline evaluator's label. */
function cleanTopic(s: string, topic: string): string {
  const t = s
    .trim()
    .replace(COPY.en.addExplanationPrefix, "")
    .replace(COPY.id.addExplanationPrefix, "");
  return t || topic;
}

/** A sentence without its closing punctuation, for splicing into another one. */
function trimEnd(s: string): string {
  return s.trim().replace(/[.!?]+$/u, "");
}
