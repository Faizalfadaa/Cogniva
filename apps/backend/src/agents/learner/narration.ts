/**
 * What was drawn while what was being said.
 *
 * The board and the voice arrive as two separate readings of the same moment:
 * a list of what is on the board, and a transcript of the talk. A teacher does
 * not use them separately. They say "this goes in here" while drawing the arrow,
 * and neither reading alone says what "this" and "here" were. The board changes
 * and the speech are timed on the same clock (the audio clip's), so each change
 * can be matched with the sentence being spoken as it was made.
 */

import type { SpeechSegment } from "../../contracts/speech.js";
import type { BoardEvent } from "../../contracts/timeline.js";

/**
 * How far outside a sentence a drawing can fall and still belong to it. People
 * finish a stroke just after the words, or start one just before; much further
 * than this and it is the pause between sentences, which belongs to neither.
 */
export const NEAR_MS = 1500;

/** How many lines to hand the student, so a long turn does not bury the rest. */
export const MAX_LINES = 8;

const SHAPE_WORDS: Record<string, string> = {
  freedraw: "drew by hand",
  arrow: "drew an arrow",
  line: "drew a line",
  rectangle: "drew a box",
  ellipse: "drew a circle",
  diamond: "drew a diamond",
  image: "added a picture",
  frame: "added a frame",
};

/** One board change in words: what was written, or what kind of mark was made. */
function describe(event: BoardEvent): string | null {
  // Excalidraw wraps long text with line breaks; inside a one-line narration
  // they would split the line in two.
  const words = event.text?.replace(/\s+/g, " ").trim();
  if (words) return `wrote "${words.length > 80 ? `${words.slice(0, 77)}...` : words}"`;
  if (event.shape === "text") return null; // text with nothing in it yet
  return (event.shape && SHAPE_WORDS[event.shape]) || "drew something";
}

/** The sentence being spoken at `at`, or the nearest one within NEAR_MS. */
function segmentAt(segments: SpeechSegment[], at: number): number | null {
  let best: number | null = null;
  let bestGap = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const { startMs, endMs } = segments[i];
    const gap = at < startMs ? startMs - at : at > endMs ? at - endMs : 0;
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  }
  return bestGap <= NEAR_MS ? best : null;
}

/**
 * Lines like `While saying "the carbon gets fixed here": drew an arrow; wrote "G3P"`,
 * in the order they happened.
 *
 * Only additions are narrated: an edit or an erasure says little about what the
 * teacher was explaining. Changes made while the mic was off, or during a pause
 * between sentences, have no sentence to go with and are left out; they are
 * still on the board, which the student sees in full anyway.
 */
export function narrate(
  events: BoardEvent[] | undefined,
  segments: SpeechSegment[] | undefined,
): string[] {
  if (!events?.length || !segments?.length) return [];

  const bySegment = new Map<number, string[]>();
  for (const event of events) {
    if (event.kind !== "add" || event.audioAt === null || event.audioAt === undefined) continue;
    const what = describe(event);
    if (!what) continue;
    const i = segmentAt(segments, event.audioAt);
    if (i === null) continue;
    const list = bySegment.get(i) ?? [];
    if (!list.includes(what)) list.push(what);
    bySegment.set(i, list);
  }

  return [...bySegment.entries()]
    .sort(([a], [b]) => a - b)
    .slice(0, MAX_LINES)
    .map(([i, actions]) => `While saying "${segments[i].text}": ${actions.join("; ")}`);
}
