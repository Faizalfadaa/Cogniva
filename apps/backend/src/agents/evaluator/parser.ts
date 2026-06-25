import { EvaluationResult, FindingCategory } from "./types";

const ALLOWED_CATEGORIES: FindingCategory[] = ["BENAR", "KELIRU", "TERLEWAT", "MEMBINGUNGKAN"];

export function parseEvaluationResult(raw: string, sessionId: string, evaluationId: string): EvaluationResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse Gemini output as JSON: ${(error as Error).message}`);
  }

  if (typeof parsed.score !== "number" || parsed.score < 0 || parsed.score > 100) {
    throw new Error("Invalid score: must be a number between 0 and 100.");
  }

  if (!Array.isArray(parsed.findings)) {
    throw new Error("Invalid findings: must be an array.");
  }

  for (const finding of parsed.findings) {
    if (!ALLOWED_CATEGORIES.includes(finding.category)) {
      throw new Error(`Invalid finding category: ${finding.category}`);
    }
  }

  return {
    evaluationId,
    sessionId,
    score: parsed.score,
    findings: parsed.findings,
    summary: parsed.summary || "",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    generatedAt: new Date().toISOString(),
  };
}
