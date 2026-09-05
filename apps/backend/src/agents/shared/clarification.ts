/**
 * Shared by the two perception agents (Vision §3.4 and ASR §3.5).
 *
 * When an agent is unsure but the model did not supply its own
 * `confirmationPrompt`, we still owe the user a concrete question -- "ragu =
 * jangan menebak" (§5.3). This builds that fallback question.
 *
 * `channel` only decides the wording of the generic case: a board that can't
 * be read and audio that can't be heard need different advice. When the model
 * did name what confused it, both channels ask the same way.
 */
export function defaultClarification(
  ambiguities: string[],
  channel: "board" | "speech",
): string {
  if (ambiguities.length > 0) {
    return `Some parts aren't clear: ${ambiguities.join("; ")}. Could you clarify or type them?`;
  }

  return channel === "board"
    ? "The board isn't very legible. Could you rewrite it more neatly or type the main points?"
    : "Some of what you said wasn't clear. Could you repeat or type the main points?";
}
