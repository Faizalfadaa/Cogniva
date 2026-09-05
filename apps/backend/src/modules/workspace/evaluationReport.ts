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
  const topic = ctx.title?.trim() || "this topic";
  const meaningful = ctx.meaningfulScore !== false;
  const tone = meaningful ? toneFromScore(result.score) : toneFromTurns(ctx.turnCount);

  const correct = result.findings.filter((f) => f.category === "CORRECT");
  const shaky = result.findings.filter((f) => f.category !== "CORRECT");

  // What landed: correct findings, then explicit strengths, then the Learner's
  // understood concepts — whichever we have.
  const learned = dedupe([
    ...correct.map((f) => f.detail || `You explained ${f.concept} well`),
    ...result.strengths,
    ...(ctx.learnerState?.understoodConcepts ?? []).map(
      (c) => `I finally get ${c}`,
    ),
  ]).slice(0, 4);

  // What's still fuzzy: non-correct findings, then improvements, then the
  // Learner's open gaps and the questions it never got answered.
  const stillConfused = dedupe([
    ...shaky.map((f) => f.detail || `The part about ${f.concept} didn't quite click`),
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

  const opening = `Hi!\n\nThank you so much for teaching me about ${topic} earlier. I really tried to follow every part of your explanation.`;

  let body: string;
  if (tone === "high") {
    body =
      "Honestly, so much clicked this time! The way you laid it out was easy to follow, so I could picture the big picture.";
  } else if (tone === "mid") {
    body =
      "I caught a fair amount, though there are a few parts I still need to go over again on my own to really get them.";
  } else {
    body =
      "I got the general direction, but honestly there's still a lot I don't fully understand yet. It's not your fault — I just need it broken down slowly.";
  }

  const praise = strength
    ? `\n\nWhat helped the most: ${lower(strength)}.`
    : "";
  const ask = improvement
    ? `\n\nNext time we continue, could we go over ${lower(improvement)}? I'm really curious about it.`
    : "\n\nTeach me again sometime, okay? I want to know what comes next!";

  const closing = `\n\nSee you again~\n— Your learner 🌱\n\n(${date})`;

  return `${opening}\n\n${body}${praise}${ask}${closing}`;
}

// --- Fallbacks -------------------------------------------------------------

function fallbackLearned(turnCount: number): string[] {
  if (turnCount === 0) return ["A first introduction to the topic"];
  return [
    "The main concept you explained early in the session",
    "The step-by-step flow you drew on the whiteboard",
    "The concrete example you gave — that's what made it click for me",
  ];
}

function fallbackConfused(turnCount: number): string[] {
  if (turnCount < 2) {
    return [
      "The connection between the concepts is still a bit fuzzy for me",
      "We didn't get to the edge cases yet",
    ];
  }
  return [
    "The details in special cases",
    "Why this approach is better than the alternatives",
    "I'm still unsure about its limits / limitations",
  ];
}

function fallbackReflection(turnCount: number): string {
  if (turnCount === 0) {
    return "This session was really short, so I couldn't absorb much yet. Let's go deeper next time!";
  }
  return "The foundation is there. The whiteboard diagrams helped a lot — with a longer session I'm sure I could catch even more.";
}

function fallbackContinue(topic: string): string[] {
  return [
    `${topic} — advanced cases & edge cases`,
    "Comparison with alternative approaches",
    "Real-world application examples",
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
  const t = s.trim().replace(/^Add an explanation of:\s*/i, "");
  return t || topic;
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
