export type ChatMessageSender = 'user' | 'learner';

export interface ChatMessageDTO {
  id: string;
  sender: ChatMessageSender;
  content: string;
  createdAt: string;
}