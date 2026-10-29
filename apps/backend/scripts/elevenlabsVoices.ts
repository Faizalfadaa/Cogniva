/**
 * List the ElevenLabs voices on your key, with the ids to paste into .env.
 *
 *   npm run tts:voices
 *
 * This exists because voice ids cannot be shipped as defaults: they belong to an
 * account, and a guessed one either 404s or bills you for a voice that is not
 * the character on screen. Rather than send someone to the dashboard to copy
 * three ids by hand, the setup prints them next to the env name each one goes
 * into.
 *
 * Reads the key the same way the server does, so if this works the server will.
 */

import "dotenv/config";
import * as config from "../src/config/index.js";
import { missingPermission } from "../src/modules/tts/elevenlabs.js";
import { LEARNER_NAMES, LEARNER_VOICES } from "../src/modules/tts/index.js";

interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
}

async function main(): Promise<void> {
  if (!config.ELEVENLABS_API_KEY) {
    console.error(
      "ELEVENLABS_API_KEY is not set.\n" +
        "Put it in apps/backend/.env (see .env.example), then run this again.",
    );
    process.exitCode = 1;
    return;
  }

  const response = await fetch(`${config.ELEVENLABS_API_BASE}/v1/voices`, {
    headers: { "xi-api-key": config.ELEVENLABS_API_KEY },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const missing = missingPermission(body);

    // The common case with a restricted key: it can speak but not list voices.
    // That is not a broken setup, so say so instead of "rejected".
    if (response.status === 401 && missing) {
      console.error(
        `This key is restricted: it works, but lacks the "${missing}" permission, so it cannot list voices.\n` +
          "Text-to-speech can still work with it. Either:\n" +
          `  - enable "${missing}" on the key (ElevenLabs › Developers › API keys), then run this again, or\n` +
          "  - copy each voice id from the dashboard: My Voices › ⋯ › Copy voice ID.\n",
      );
      reportConfigured();
      process.exitCode = 1;
      return;
    }

    console.error(
      `ElevenLabs returned ${response.status}.` +
        (response.status === 401 ? " The key was rejected." : "") +
        (body ? `\n${body.slice(0, 300)}` : ""),
    );
    process.exitCode = 1;
    return;
  }

  const { voices = [] } = (await response.json()) as { voices?: Voice[] };

  if (voices.length === 0) {
    console.log("No voices on this key yet. Add one in the ElevenLabs voice library first.");
    return;
  }

  console.log(`\n${voices.length} voice(s) on this key:\n`);
  for (const voice of voices) {
    const traits = [voice.category, voice.labels?.accent, voice.labels?.gender]
      .filter(Boolean)
      .join(", ");
    console.log(`  ${voice.voice_id}  ${voice.name}${traits ? `  (${traits})` : ""}`);
  }

  console.log("\nAssign one per student in apps/backend/.env:\n");
  for (const character of LEARNER_VOICES) {
    const current = config.ELEVENLABS_VOICE_IDS[character];
    const shown = current || "<paste a voice id above>";
    console.log(
      `  COGNIVA_ELEVENLABS_VOICE_${character.toUpperCase()}=${shown}` +
        `${current ? "" : `   # ${LEARNER_NAMES[character]}`}`,
    );
  }
  console.log("\nOr one voice for all three: COGNIVA_ELEVENLABS_VOICE_ID=<voice id>\n");

  // The plan is worth knowing before a session: characters, not requests, are
  // what runs out, and a reply is a few hundred of them.
  const plan = await fetch(`${config.ELEVENLABS_API_BASE}/v1/user/subscription`, {
    headers: { "xi-api-key": config.ELEVENLABS_API_KEY },
  })
    .then((res) => (res.ok ? (res.json() as Promise<Record<string, unknown>>) : null))
    .catch(() => null);

  if (plan) {
    console.log(
      `Plan: ${String(plan.tier ?? "unknown")} — ` +
        `${Number(plan.character_count ?? 0).toLocaleString()} of ` +
        `${Number(plan.character_limit ?? 0).toLocaleString()} characters used.\n`,
    );
  }
}

/** What is already set, so a restricted key still shows whether setup is done. */
function reportConfigured(): void {
  console.error("Currently configured:");
  for (const character of LEARNER_VOICES) {
    const id = config.ELEVENLABS_VOICE_IDS[character];
    console.error(
      `  COGNIVA_ELEVENLABS_VOICE_${character.toUpperCase()}: ${id ? "set" : "MISSING"}  (${LEARNER_NAMES[character]})`,
    );
  }
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
