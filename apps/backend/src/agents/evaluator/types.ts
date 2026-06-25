import { TeachingTurn } from "../transcript/types";

export type FindingCategory = "BENAR" | "KELIRU" | "TERLEWAT" | "MEMBINGUNGKAN";

export interface Finding {
  category: FindingCategory;
  concept: string;
  detail: string;
  evidenceTurnIndex?: number;
}

export interface EvaluationResult {
  evaluationId: string;
  sessionId: string;
  score: number;
  findings: Finding[];
  summary: string;
  strengths: string[];
  improvements: string[];
  generatedAt: string;
}

export interface EvaluatorInput {
  sessionId: string;
  turns: TeachingTurn[];
  referenceMaterial: string;
  keyConcepts: string[];
  commonMisconceptions: string[];
}
