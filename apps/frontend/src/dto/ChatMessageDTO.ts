import type { LearnerSpeechDTO } from './LearnerSpeechDTO';

export type ChatMessageSender = 'user' | 'learner';

export interface ChatMessageDTO {
  id: string;
  sender: ChatMessageSender;
  content: string;
  /** Legacy: the whole learner bubble as one clip, for messages recorded before
   *  per-sentence speech. Absent for user messages. */
  learnerAudioUrl?: string;
  /** The learner bubble as per-sentence speech. Absent for user messages and
   *  whenever the voice is off. */
  speech?: LearnerSpeechDTO;
  createdAt: string;
}
