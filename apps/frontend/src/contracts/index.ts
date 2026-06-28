/**
 * Cogniva inter-component data contracts — frontend side (Architecture Document §6).
 *
 * The core output of Milestone M0. These types MUST stay in sync with the
 * backend Zod schemas (apps/backend/src/contracts). Conventions: camelCase
 * fields, JSON exchange, ISO-8601 (UTC) timestamps, optional fields marked `?`.
 * Any change to these contracts must be agreed with the tech lead.
 */

// --- Enumerations (§4, §6) -------------------------------------------------

export type SessionStatus = "SETUP" | "TEACHING" | "ENDED" | "EVALUATED";

export type Difficulty = "easy" | "medium" | "hard";

export type ElementType =
  | "text"
  | "equation"
  | "diagram"
  | "arrow"
  | "figure";

export type LearnerResponseType =
  | "question"
  | "confusion"
  | "acknowledgment"
  | "paraphrase";

export type DerivedFrom = "gap" | "misconception" | "new_info";

export type FindingCategory =
  | "CORRECT"
  | "WRONG"
  | "MISSED"
  | "CONFUSING";

// --- Topic (§6.1) ----------------------------------------------------------

export interface Topic {
  topicId: string;
  title: string;
  description: string;
  /** Reference material (markdown) as the source of truth. */
  referenceMaterial: string;
  keyConcepts: string[];
  /** Common misconceptions; seeds for the Learner's faulty beliefs. */
  commonMisconceptions: string[];
  difficulty: Difficulty;
}

// --- Session (§6.2) --------------------------------------------------------

export interface Session {
  sessionId: string;
  topicId: string;
  status: SessionStatus;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  turnCount: number;
  evaluationId?: string;
}

// --- Visual channel (§6.3, §6.4) ------------------------------------------

export interface BoardSnapshot {
  snapshotId: string;
  sessionId: string;
  turnIndex: number;
  /** Image data as base64 or object URL. */
  image: string;
  format: string;
  capturedAt: string;
}

export interface Element {
  type: ElementType;
  content: string;
  /** Bounding box [x, y, w, h]. */
  bbox?: [number, number, number, number];
}

export interface VisionInterpretation {
  snapshotId: string;
  transcribedText: string;
  elements: Element[];
  /** Confidence level 0..1. */
  confidence: number;
  /** true when confidence is below threshold. */
  needsConfirmation: boolean;
  suggestedClarification?: string;
}

// --- Voice channel (§6.5) --------------------------------------------------

export interface SpeechTranscript {
  segmentId: string;
  sessionId: string;
  turnIndex: number;
  transcript: string;
  audioRef?: string;
  /** ASR confidence level 0..1. */
  confidence: number;
  /** Language code, e.g. "en-US". */
  language: string;
  capturedAt: string;
}

// --- TeachingTurn (§6.6) ---------------------------------------------------

export interface TeachingTurn {
  turnIndex: number;
  sessionId: string;
  snapshotId: string;
  interpretation: VisionInterpretation;
  speechTranscript?: SpeechTranscript;
  typedInput?: string;
  learnerResponseId: string;
  createdAt: string;
}

// --- Learner (§6.7, §6.8) --------------------------------------------------

export interface Misc {
  concept: string;
  belief: string;
}

export interface LearnerState {
  sessionId: string;
  understoodConcepts: string[];
  activeMisconceptions: Misc[];
  openGaps: string[];
  questionsAsked: string[];
  updatedAtTurn: number;
}

export interface LearnerResponse {
  responseId: string;
  turnIndex: number;
  type: LearnerResponseType;
  text: string;
  targetConcept?: string;
  derivedFrom: DerivedFrom;
}

// --- Evaluation (§6.9) -----------------------------------------------------

export interface Finding {
  category: FindingCategory;
  concept: string;
  detail: string;
  evidenceTurnIndex?: number;
}

export interface EvaluationResult {
  evaluationId: string;
  sessionId: string;
  /** Overall score 0..100. */
  score: number;
  findings: Finding[];
  summary: string;
  strengths: string[];
  improvements: string[];
  generatedAt: string;
}
