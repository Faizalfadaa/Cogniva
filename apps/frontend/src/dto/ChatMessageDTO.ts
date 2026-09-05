export type ChatMessageSender = 'user' | 'learner';

export interface ChatMessageDTO {
  id: string;
  sender: ChatMessageSender;
  content: string;
  /** Endpoint URL of the spoken learner bubble (XTTS). Absent for user messages. */
  learnerAudioUrl?: string;
  createdAt: string;
}