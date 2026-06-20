/**
 * Kontrak data antar-komponen Cogniva — sisi frontend (Dokumen Arsitektur §6).
 *
 * Inti keluaran Milestone M0. Tipe-tipe ini HARUS sepadan dengan model
 * Pydantic backend (backend/app/contracts). Konvensi: field camelCase,
 * pertukaran JSON, waktu ISO-8601 (UTC), field opsional bertanda `?`.
 * Perubahan apa pun atas kontrak ini harus melalui kesepakatan tech lead.
 */

// --- Enumerasi (§4, §6) ----------------------------------------------------

export type SessionStatus = "PERSIAPAN" | "MENGAJAR" | "SELESAI" | "EVALUASI";

export type Difficulty = "dasar" | "menengah" | "lanjut";

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
  | "BENAR"
  | "KELIRU"
  | "TERLEWAT"
  | "MEMBINGUNGKAN";

// --- Topic (§6.1) ----------------------------------------------------------

export interface Topic {
  topicId: string;
  title: string;
  description: string;
  /** Materi rujukan (markdown) sebagai acuan kebenaran. */
  referenceMaterial: string;
  keyConcepts: string[];
  /** Miskonsepsi umum; benih perilaku keliru Learner. */
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

// --- Kanal visual (§6.3, §6.4) --------------------------------------------

export interface BoardSnapshot {
  snapshotId: string;
  sessionId: string;
  turnIndex: number;
  /** Data gambar base64 atau URL objek. */
  image: string;
  format: string;
  capturedAt: string;
}

export interface Element {
  type: ElementType;
  content: string;
  /** Kotak pembatas [x, y, w, h]. */
  bbox?: [number, number, number, number];
}

export interface VisionInterpretation {
  snapshotId: string;
  transcribedText: string;
  elements: Element[];
  /** Tingkat keyakinan 0..1. */
  confidence: number;
  /** true bila keyakinan di bawah ambang. */
  needsConfirmation: boolean;
  suggestedClarification?: string;
}

// --- Kanal suara (§6.5) ----------------------------------------------------

export interface SpeechTranscript {
  segmentId: string;
  sessionId: string;
  turnIndex: number;
  transcript: string;
  audioRef?: string;
  /** Tingkat keyakinan ASR 0..1. */
  confidence: number;
  /** Kode bahasa, mis. "id-ID". */
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
  /** Skor keseluruhan 0..100. */
  score: number;
  findings: Finding[];
  summary: string;
  strengths: string[];
  improvements: string[];
  generatedAt: string;
}
