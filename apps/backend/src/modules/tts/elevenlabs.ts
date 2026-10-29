/**
 * The hosted voice engine: ElevenLabs over plain HTTP.
 *
 * Same contract as the local sidecar (see ./index.ts): every path resolves to
 * `null` rather than throwing, so a learner reply always reaches the user — with
 * audio when the key, the quota and the network allow, silently without it when
 * they do not. A voice is a nicety; the reply is the product.
 *
 * Two things this engine can do that the local one cannot, and both are used:
 *
 *   - It speaks Indonesian. The local engines do not, which is why TTS_LANGUAGE
 *     is pinned to English there. Here the session's own language is sent.
 *   - It can be told what comes before and after the sentence being rendered.
 *     A reply is split into several clips (speechSegments) and rendered one at a
 *     time; without that context each clip is read as if it were a whole
 *     utterance, and the seams are audible as resets in pitch and pace.
 *
 * No voice ids are hard-coded. They belong to an account, and a guessed id would
 * 404 or bill someone for a voice that is not the character on screen. See
 * `npm run tts:voices`.
 */

import * as config from "../../config/index.js";
import type { SynthesizedSpeech } from "./index.js";

/** Neighbouring sentences of the one being rendered, for continuous prosody. */
export interface SpeechContext {
  previous?: string;
  next?: string;
}

/** The body the API takes. Optional fields are omitted rather than nulled. */
interface ConvertRequest {
  text: string;
  model_id: string;
  language_code?: string;
  previous_text?: string;
  next_text?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    speed?: number;
  };
}

/**
 * Mime type for an output format, for the clip we store and the browser plays.
 *
 * The response carries a content-type of its own and that is what is used when
 * present; this is the fallback, and it is derived from the format name rather
 * than assumed, because the same endpoint can return mp3, opus, pcm or wav.
 */
export function mimeForOutputFormat(format: string): string {
  if (format.startsWith("mp3")) return "audio/mpeg";
  if (format.startsWith("opus")) return "audio/ogg";
  if (format.startsWith("wav")) return "audio/wav";
  if (format.startsWith("pcm")) return "audio/basic";
  if (format.startsWith("ulaw") || format.startsWith("alaw")) return "audio/basic";
  return "application/octet-stream";
}

/** ISO 639-1 for a session locale. The app's two locales already are one. */
function languageCode(locale: string | undefined): string | undefined {
  if (!locale) return undefined;
  const code = locale.trim().toLowerCase().slice(0, 2);
  return code.length === 2 ? code : undefined;
}

/**
 * Which hosted voice a character speaks with, or "" when none is configured.
 */
export function elevenLabsVoiceId(voice: string): string {
  return config.ELEVENLABS_VOICE_IDS[voice] ?? "";
}

/** Only sent when the user actually set one, so stored settings stay in charge. */
function voiceSettings(): ConvertRequest["voice_settings"] | undefined {
  const settings = {
    ...(config.ELEVENLABS_STABILITY !== undefined
      ? { stability: config.ELEVENLABS_STABILITY }
      : {}),
    ...(config.ELEVENLABS_SIMILARITY !== undefined
      ? { similarity_boost: config.ELEVENLABS_SIMILARITY }
      : {}),
    ...(config.ELEVENLABS_STYLE !== undefined ? { style: config.ELEVENLABS_STYLE } : {}),
    ...(config.ELEVENLABS_SPEED !== undefined ? { speed: config.ELEVENLABS_SPEED } : {}),
  };
  return Object.keys(settings).length > 0 ? settings : undefined;
}

/** Said once per process, not once per sentence: the cause never changes. */
let warnedMissingKey = false;
let warnedMissingVoice = false;

function warnOnce(which: "key" | "voice", message: string): void {
  if (which === "key") {
    if (warnedMissingKey) return;
    warnedMissingKey = true;
  } else {
    if (warnedMissingVoice) return;
    warnedMissingVoice = true;
  }
  console.error(message);
}

/**
 * Render one sentence. Returns null for every failure, having said why once.
 */
export async function synthesizeWithElevenLabs(
  text: string,
  voice: string,
  locale?: string,
  context?: SpeechContext,
): Promise<SynthesizedSpeech | null> {
  if (!config.ELEVENLABS_API_KEY) {
    warnOnce(
      "key",
      "[tts] ElevenLabs is selected but ELEVENLABS_API_KEY is not set; continuing without audio",
    );
    return null;
  }

  const voiceId = elevenLabsVoiceId(voice);
  if (!voiceId) {
    warnOnce(
      "voice",
      `[tts] no ElevenLabs voice id for "${voice}": set COGNIVA_ELEVENLABS_VOICE_${voice.toUpperCase()} ` +
        "(or COGNIVA_ELEVENLABS_VOICE_ID for all of them). `npm run tts:voices` lists the ids on your key.",
    );
    return null;
  }

  const body: ConvertRequest = {
    text,
    model_id: config.ELEVENLABS_MODEL,
    ...(config.ELEVENLABS_LANGUAGE_CODE && languageCode(locale)
      ? { language_code: languageCode(locale) }
      : {}),
    ...(context?.previous ? { previous_text: context.previous } : {}),
    ...(context?.next ? { next_text: context.next } : {}),
    ...(voiceSettings() ? { voice_settings: voiceSettings() } : {}),
  };

  const url =
    `${config.ELEVENLABS_API_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}` +
    `?output_format=${encodeURIComponent(config.ELEVENLABS_OUTPUT_FORMAT)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.TTS_TIMEOUT * 1000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": config.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        accept: "audio/*",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[tts] ElevenLabs returned ${response.status}: ${await explain(response)}`);
      return null;
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length === 0) {
      console.error("[tts] ElevenLabs returned empty audio (HTTP 200); continuing without audio");
      return null;
    }

    return {
      audio,
      mime:
        response.headers.get("content-type") ??
        mimeForOutputFormat(config.ELEVENLABS_OUTPUT_FORMAT),
      // A hosted voice is the account's own, not a reference clip this app
      // cloned at render time — which is what `cloned` reports.
      cloned: false,
    };
  } catch (err) {
    const reason = controller.signal.aborted ? "timed out" : transportFailure(err);
    console.error(`[tts] ElevenLabs unavailable (${reason}); continuing without audio`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A readable reason for a failed call.
 *
 * The status alone does not say enough to act on: 401 is a bad key, 402 and 429
 * are a spent quota or too many calls at once, and 422 is usually an unknown
 * voice id or model. Only structured status codes are logged: provider messages
 * can echo private request data.
 */
async function explain(response: Response): Promise<string> {
  let body = "";
  try {
    body = await response.text();
  } catch {
    // A body that cannot be read changes nothing: the status and hint stand.
  }

  // A restricted key is a working key: it simply lacks the permission for this
  // endpoint. Saying "rejected" sends someone off to rotate a key that is fine,
  // so the permission the API names is reported instead.
  const missing = missingPermission(body);
  if (response.status === 401 && missing) {
    return `the key works but lacks the "${missing}" permission — enable it on the key in ElevenLabs`;
  }

  const hint =
    response.status === 401
      ? "the API key was rejected"
      : response.status === 402
      ? "the account's character quota is spent"
      : response.status === 429
      ? "too many requests for this plan"
      : response.status === 422
      ? "the voice id or model was not accepted"
      : "see the body";

  // Do not log provider messages: they may echo text, credentials or account data.
  let detail = "";
  try {
    const status: unknown = JSON.parse(body)?.detail?.status;
    if (typeof status === "string" && /^[a-z_]{1,64}$/.test(status) &&
        !status.includes(config.ELEVENLABS_API_KEY)) detail = status;
  } catch { /* Non-JSON errors are represented by the HTTP status and hint. */ }
  return detail ? `${hint} — ${detail}` : hint;
}

/** Only structural transport diagnostics, never arbitrary messages or URLs. */
export function transportFailure(error: unknown): string {
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number): string => {
    if (!value || typeof value !== "object" || depth > 4 || seen.has(value)) return "";
    seen.add(value);
    const e = value as { name?: unknown; code?: unknown; syscall?: unknown; cause?: unknown; errors?: unknown };
    const fields = ["name", "code", "syscall"] as const;
    const parts = fields.flatMap((field) => {
      const v = e[field];
      return typeof v === "string" && /^[a-zA-Z0-9_]{1,64}$/.test(v) &&
        (!config.ELEVENLABS_API_KEY || !v.includes(config.ELEVENLABS_API_KEY)) ? [`${field}=${v}`] : [];
    });
    const cause = visit(e.cause, depth + 1);
    if (cause) parts.push(`cause={${cause}}`);
    if (Array.isArray(e.errors)) {
      for (const child of e.errors.slice(0, 4)) {
        const detail = visit(child, depth + 1);
        if (detail) parts.push(`error={${detail}}`);
      }
    }
    return parts.join(" ");
  };
  return visit(error, 0) || "unknown transport error";
}

/**
 * The permission a restricted key is missing, from the API's error body
 * (`{"detail":{"status":"missing_permissions","message":"…the permission
 * voices_read…"}}`), or undefined when the error is something else.
 */
export function missingPermission(body: string): string | undefined {
  try {
    const detail = (JSON.parse(body) as { detail?: { status?: string; message?: string } }).detail;
    if (detail?.status !== "missing_permissions") return undefined;
    return detail.message?.match(/permission\s+([a-z_]+)/i)?.[1] ?? "required";
  } catch {
    return undefined;
  }
}

/** What the key can still do: the plan and the characters left on it. */
export async function elevenLabsHealth(): Promise<Record<string, unknown> | null> {
  if (!config.ELEVENLABS_API_KEY) return null;

  try {
    const response = await fetch(`${config.ELEVENLABS_API_BASE}/v1/user/subscription`, {
      headers: { "xi-api-key": config.ELEVENLABS_API_KEY },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;

    const plan = (await response.json()) as {
      tier?: string;
      character_count?: number;
      character_limit?: number;
    };

    return {
      engine: "elevenlabs",
      model: config.ELEVENLABS_MODEL,
      tier: plan.tier,
      charactersUsed: plan.character_count,
      characterLimit: plan.character_limit,
      // Named per character so a missing id is obvious at a glance.
      voices: Object.fromEntries(
        Object.entries(config.ELEVENLABS_VOICE_IDS).map(([name, id]) => [name, Boolean(id)]),
      ),
    };
  } catch {
    return null;
  }
}
