import { RawChatSession, TeachingTurn } from "./types";

export function buildTranscript(session: RawChatSession): TeachingTurn[] {
  const turns: TeachingTurn[] = [];
  let turnIndex = 0;

  for (const message of session.messages) {
    if (message.role === "user") {
      turns.push({
        turnIndex: turnIndex++,
        sessionId: session.sessionId,
        interpretation: {
          transcribedText: message.content,
          elements: []
        },
        typedInput: message.content,
        learnerResponseId: message.messageId,
        createdAt: message.createdAt
      });
    }
  }

  return turns;
}
