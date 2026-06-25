export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  messageId: string;
  sessionId: string;
  role: MessageRole;
  content: string;           // raw text content of the message
  createdAt: string;         // ISO-8601
}

export interface RawChatSession {
  sessionId: string;
  messages: ChatMessage[];
}

export interface TeachingTurn {
  turnIndex: number;
  sessionId: string;
  interpretation: { transcribedText: string; elements: any[] };
  speechTranscript?: { transcript: string };
  typedInput?: string;
  learnerResponseId: string;
  createdAt: string;
}
