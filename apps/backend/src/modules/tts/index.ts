/**
 * Voice synthesis — the student's replies, spoken through ElevenLabs.
 *
 * The call itself lives in ./elevenlabs.ts; this module is the seam the rest of
 * the app uses, plus the character/voice mapping and the sentence splitting that
 * decides what gets rendered.
 *
 * There was a second engine here once: a Python sidecar (Chatterbox/XTTS) in
 * services/tts. It was removed — it needed a GPU to be worth using and spoke no
 * Indonesian, which made it useless for this app's main audience. Nothing
 * replaced it, and nothing had to: the rule the rest of the app follows applies
 * here too. A missing AI dependency must never break the flow. Every function
 * resolves to `null` instead of throwing, so a learner reply always reaches the
 * user — with audio when the key, the quota and the network allow, silently
 * without it when they do not.
 */

import * as config from "../../config/index.js";
import {
  elevenLabsHealth,
  synthesizeWithElevenLabs,
  type SpeechContext,
} from "./elevenlabs.js";

export type { SpeechContext } from "./elevenlabs.js";

/** Rendered speech for one learner utterance. */
export interface SynthesizedSpeech {
  audio: Buffer;
  mime: string;
  /**
   * Whether the voice was cloned from a reference recording at render time.
   *
   * Always false now: a hosted voice belongs to the account and is not cloned
   * per request. Kept because the field is stored on clips that predate the
   * change, and the shape is read back from the database.
   */
  cloned: boolean;
}

/**
 * Voice ids, in the order the frontend's `deriveLearner` picks them, and named
 * to match the character ids in apps/frontend/src/lib/Learner.ts.
 */
export const LEARNER_VOICES = ["yuzuki", "reina", "akira"] as const;

export type LearnerVoice = (typeof LEARNER_VOICES)[number];

/**
 * The name each character answers to, as apps/frontend/src/lib/Learner.ts
 * shows it. The student is told this name so it introduces itself as the
 * character on screen: the prompt used to call every student "Iva", and asking
 * Yuzuki her name got "My name is Iva".
 */
export const LEARNER_NAMES = {
  yuzuki: "Yuzuki Akatsuki",
  reina: "Reina Kisaragi",
  akira: "Akira Kagetsu",
} as const satisfies Record<LearnerVoice, string>;

/**
 * The default character for a workspace nobody has chosen for.
 *
 * MUST stay identical to `deriveLearner` in
 * apps/frontend/src/lib/Learner.ts — same hash, same array order.
 *
 * This used to be the whole story, and for a while it was right: the character
 * was purely a function of the workspace id, so both sides could compute it
 * independently. Then the picker (LearnerSelect) let the user override it, and
 * the override lived only in the browser — which is how a workspace showing
 * Yuzuki came back speaking in Akira's voice. Prefer `voiceForWorkspace` below;
 * this is only the fallback it uses.
 */
export function ttsVoiceForWorkspace(workspaceId: string): LearnerVoice {
  let hash = 0;
  for (let i = 0; i < workspaceId.length; i++) {
    hash = (hash * 31 + workspaceId.charCodeAt(i)) >>> 0;
  }
  return LEARNER_VOICES[hash % LEARNER_VOICES.length];
}

/**
 * The voice to speak in: the character the user picked, or the id-derived
 * default when they never picked one.
 *
 * Mirrors `resolveLearner` on the frontend, which is what actually draws the
 * face on screen — that is the thing the voice has to agree with.
 * `tests/tts.test.ts` locks the two together.
 *
 * An unrecognized id falls back rather than throwing. It reaches here straight
 * from a client, and a voice nobody can render is not worth failing a whole
 * teaching turn over.
 */
export function voiceForWorkspace(
  learnerId: string | undefined,
  workspaceId: string,
): LearnerVoice {
  const chosen = LEARNER_VOICES.find((voice) => voice === learnerId);
  return chosen ?? ttsVoiceForWorkspace(workspaceId);
}

/**
 * The name of the student in this workspace, resolved the same way as its
 * voice, so the name it gives and the face and voice it has always agree.
 */
export function learnerNameForWorkspace(
  learnerId: string | undefined,
  workspaceId: string,
): string {
  return LEARNER_NAMES[voiceForWorkspace(learnerId, workspaceId)];
}

/**
 * Render `text` in `voice`. Returns null when speech is off, no key or voice is
 * configured, or the call fails for any reason — never throws.
 *
 * `locale` is the session's language and `context` the sentences either side of
 * this one; both are hints that make the rendering better and neither is
 * required.
 */
export async function synthesizeSpeech(
  text: string,
  voice: string,
  locale?: string,
  context?: SpeechContext,
): Promise<SynthesizedSpeech | null> {
  if (!config.TTS_ENABLED) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  return synthesizeWithElevenLabs(trimmed, voice, locale, context);
}

/** What the key can still do. Null when the voice is off or unreachable. */
export async function ttsHealth(): Promise<Record<string, unknown> | null> {
  if (!config.TTS_ENABLED) return null;
  return elevenLabsHealth();
}

/** A sentence shorter than this is merged into a neighbour before rendering. */
const MIN_SEGMENT_WORDS = 4;

/** Upper bound on clips per reply; whatever is past it rides with the last one. */
const MAX_SEGMENTS = 4;

/**
 * Split a learner reply into the pieces that are rendered and played one by one.
 *
 * Cut at sentence boundaries, because that is where a speaker pauses anyway — a
 * cut anywhere else is audible. Two corrections on top of that:
 *
 *   - A very short sentence ("Hmm." / "Right?") is merged into its neighbour. On
 *     its own it renders with odd prosody and costs a whole request for half a
 *     second of audio.
 *   - The number of pieces is capped, because each one is a separate render.
 *
 * Joining the pieces with single spaces gives back the reply with its whitespace
 * normalised; nothing is dropped.
 */
export function speechSegments(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    // After terminal punctuation, optionally followed by closing quotes/brackets.
    .split(/(?<=[.!?…]["'”’)\]]*)\s+(?=\S)/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const pieces: string[] = [];
  let carry = "";
  for (const sentence of sentences) {
    const piece = carry ? `${carry} ${sentence}` : sentence;
    if (wordCount(piece) < MIN_SEGMENT_WORDS) {
      carry = piece;
      continue;
    }
    pieces.push(piece);
    carry = "";
  }
  if (carry) {
    if (pieces.length > 0) pieces[pieces.length - 1] = `${pieces[pieces.length - 1]} ${carry}`;
    else pieces.push(carry);
  }

  if (pieces.length <= MAX_SEGMENTS) return pieces;
  return [...pieces.slice(0, MAX_SEGMENTS - 1), pieces.slice(MAX_SEGMENTS - 1).join(" ")];
}

function wordCount(text: string): number {
  return text.split(" ").filter(Boolean).length;
}
