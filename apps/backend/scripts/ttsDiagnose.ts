/** Read-only checks: no speech generation, audio billing, keys or user text in output. */
import "dotenv/config";
import * as config from "../src/config/index.js";
import { transportFailure } from "../src/modules/tts/elevenlabs.js";

console.log({
  enabled: config.TTS_ENABLED,
  keyConfigured: Boolean(config.ELEVENLABS_API_KEY),
  voicesConfigured: Object.fromEntries(Object.entries(config.ELEVENLABS_VOICE_IDS)
    .map(([name, id]) => [name, Boolean(id)])),
});

try {
  const base = new URL(config.ELEVENLABS_API_BASE);
  if (base.username || base.password || base.search || base.hash || base.protocol !== "https:") {
    throw new Error("Invalid base");
  }
  const response = await fetch(`${config.ELEVENLABS_API_BASE}/v1/models`, {
    headers: config.ELEVENLABS_API_KEY ? { "xi-api-key": config.ELEVENLABS_API_KEY } : {},
    signal: AbortSignal.timeout(10_000),
  });
  console.log({ check: "models", httpStatus: response.status });
  if (response.ok) {
    const models = await response.json() as { model_id: string; can_do_text_to_speech?: boolean }[];
    console.log({ configuredModelSupportsTts: models.some(
      (model) => model.model_id === config.ELEVENLABS_MODEL && model.can_do_text_to_speech,
    ) });
  } else {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`[tts diagnosis] ${transportFailure(error)}`);
  process.exitCode = 1;
}
