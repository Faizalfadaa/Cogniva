import { describe, it, expect } from "vitest";
import { buildTranscript } from "../transcriptBuilder";
import { RawChatSession } from "../types";

describe("transcriptBuilder", () => {
  it("converts only user messages to teaching turns chronologically", () => {
    const session: RawChatSession = {
      sessionId: "session-123",
      messages: [
        {
          messageId: "msg-1",
          sessionId: "session-123",
          role: "system",
          content: "You are a helpful tutor.",
          createdAt: "2026-06-25T00:00:00.000Z",
        },
        {
          messageId: "msg-2",
          sessionId: "session-123",
          role: "user",
          content: "Photosynthesis is the process by which plants make food.",
          createdAt: "2026-06-25T00:01:00.000Z",
        },
        {
          messageId: "msg-3",
          sessionId: "session-123",
          role: "assistant",
          content: "That's correct! What do they need for this process?",
          createdAt: "2026-06-25T00:02:00.000Z",
        },
        {
          messageId: "msg-4",
          sessionId: "session-123",
          role: "user",
          content: "They need sunlight, water, and carbon dioxide.",
          createdAt: "2026-06-25T00:03:00.000Z",
        },
      ],
    };

    const turns = buildTranscript(session);

    expect(turns).toHaveLength(2);
    
    expect(turns[0].turnIndex).toBe(0);
    expect(turns[0].typedInput).toBe("Photosynthesis is the process by which plants make food.");
    expect(turns[0].interpretation.transcribedText).toBe("Photosynthesis is the process by which plants make food.");
    expect(turns[0].learnerResponseId).toBe("msg-2");

    expect(turns[1].turnIndex).toBe(1);
    expect(turns[1].typedInput).toBe("They need sunlight, water, and carbon dioxide.");
    expect(turns[1].interpretation.transcribedText).toBe("They need sunlight, water, and carbon dioxide.");
    expect(turns[1].learnerResponseId).toBe("msg-4");
  });
});
