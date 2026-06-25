export type SessionStatus = 'PERSIAPAN' | 'MENGAJAR' | 'SELESAI' | 'EVALUASI';
export type Difficulty = 'dasar' | 'menengah' | 'lanjut';
export type LearnerResponseType = 'question' | 'confusion' | 'acknowledgment' | 'paraphrase';
export type FindingCategory = 'BENAR' | 'KELIRU' | 'TERLEWAT' | 'MEMBINGUNGKAN';
export type ElementType = 'text' | 'equation' | 'diagram' | 'arrow' | 'figure';

export interface Topic {
  topicId: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  referenceMaterial?: string;
  keyConcepts?: string[];
  commonMisconceptions?: string[];
  estimatedTurns?: string;
  icon?: string;
}

export interface Session {
  sessionId: string;
  topicId: string;
  topicTitle?: string;
  status: SessionStatus;
  turnCount: number;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  evaluationId?: string;
}

export interface Element {
  type: ElementType;
  content: string;
  bbox?: [number, number, number, number];
}

export interface VisionInterpretation {
  snapshotId: string;
  transcribedText: string;
  elements: Element[];
  confidence: number;
  needsConfirmation: boolean;
  suggestedClarification?: string;
}

export interface LearnerResponse {
  responseId: string;
  turnIndex: number;
  type: LearnerResponseType;
  text: string;
  targetConcept?: string;
  derivedFrom?: 'gap' | 'misconception' | 'new_info';
}

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

export interface DialogMessage {
  id: string;
  role: 'user' | 'learner';
  content: string;
  responseType?: LearnerResponseType;
  turnIndex?: number;
  timestamp: string;
}
