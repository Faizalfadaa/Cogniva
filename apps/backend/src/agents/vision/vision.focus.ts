import type { VisionInterpretation } from "../../contracts/board.js";

/**
 * The student's "reread_board" tool — WITHOUT a second image upload.
 *
 * The board is a static image already interpreted once this turn (the
 * orchestrator's main `vision.interpret` call). A focused "re-read" therefore
 * doesn't need a second multimodal Vision call (re-sending the whole image costs
 * thousands of tokens + upload latency in the real-time loop); it just surfaces
 * the parts of that existing interpretation that match `focus`.
 *
 * Matching is on the extracted `content` text. (`Element` now also carries a
 * per-element `confidence`, but the student is asking "what does this part
 * say", not "how sure are you", so it isn't used for matching.) When nothing
 * matches, we fall back to the full transcript so the student always gets
 * something to work with.
 */
export function focusInterpretation(
  interp: VisionInterpretation,
  focus: string,
): string {
  const text = interp.transcribedText?.trim() ?? "";
  const keywords = focus
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  if (keywords.length === 0) {
    return text || "(tidak ada detail tambahan yang terbaca di papan)";
  }

  const matches = interp.elements.filter((e) =>
    keywords.some((k) => e.content.toLowerCase().includes(k)),
  );

  if (matches.length > 0) {
    return matches.map((e) => `${e.type}: ${e.content}`).join("; ");
  }

  return text || "(tidak ada detail tambahan yang terbaca di bagian itu)";
}
