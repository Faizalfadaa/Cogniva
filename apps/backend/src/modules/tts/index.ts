/**
 * Voice synthesis client — talks to the XTTS v2 service in services/tts.
 *
 * The rule the rest of the app follows applies here too: a missing AI dependency
 * must never break the flow. Every function in this module resolves to `null`
 * instead of throwing, so a learner reply always reaches the user — with audio
 * when the service is up, silently without it when it is not.
 *
 * The service is a separate Python process because XTTS v2 is a PyTorch model
 * with no usable Node binding. See services/tts/README.md.
 */

import * as config from "../../config/index.js";

/** Rendered speech for one learner utterance. */
export interface SynthesizedSpeech {
  audio: Buffer;
  mime: string;
  /** True when a cloned reference voice was used, false for the built-in one. */
  cloned: boolean;
}

/**
 * Voice ids, in the order the frontend's `deriveLearner` picks them, and named
 * to match the character ids in apps/frontend/src/lib/Learner.ts.
 */
export const LEARNER_VOICES = ["yuzuki", "reina", "akira"] as const;

export type LearnerVoice = (typeof LEARNER_VOICES)[number];

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
 * Render `text` in `voice`. Returns null when speech is off, the service is
 * unreachable, still loading, or slow — never throws.
 */
export async function synthesizeSpeech(
  text: string,
  voice: string,
): Promise<SynthesizedSpeech | null> {
  if (!config.TTS_ENABLED) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.TTS_TIMEOUT * 1000);

  try {
    const response = await fetch(`${config.TTS_URL}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: trimmed,
        voice,
        language: config.TTS_LANGUAGE,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // 503 is the expected answer while the model warms up, and is not worth
      // a stack trace on every early request.
      const level = response.status === 503 ? "log" : "error";
      console[level](`[tts] service returned ${response.status}; continuing without audio`);
      return null;
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length === 0) return null;

    return {
      audio,
      mime: response.headers.get("content-type") ?? "audio/wav",
      cloned: response.headers.get("x-tts-cloned") === "1",
    };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "timed out" : String(err);
    console.error(`[tts] synthesis unavailable (${reason}); continuing without audio`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Probe the service. Used by /health and by the demo script. */
export async function ttsHealth(): Promise<Record<string, unknown> | null> {
  if (!config.TTS_ENABLED) return null;
  try {
    const response = await fetch(`${config.TTS_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
