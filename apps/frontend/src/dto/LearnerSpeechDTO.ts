/**
 * A learner reply as speech, one clip per sentence.
 *
 * Mirrors LearnerSpeech in apps/backend/src/contracts/workspace.ts — change both
 * together; the bridge does no field remapping.
 */
export type LearnerSpeechStatus = 'pending' | 'ready' | 'unavailable';

export interface SpeechSegmentDTO {
  text: string;
  /** Endpoint URL of this sentence's clip; absent until it has been rendered. */
  audioUrl?: string;
}

export interface LearnerSpeechDTO {
  /** Shared by a checkpoint and its chat mirror, so the line is spoken once. */
  id: string;
  /**
   * pending      at least one sentence is still rendering
   * ready        every sentence has audio
   * unavailable  synthesis stopped; show the rest as text instead of waiting
   */
  status: LearnerSpeechStatus;
  segments: SpeechSegmentDTO[];
}
