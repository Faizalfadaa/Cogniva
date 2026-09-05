import type { AIMessage } from "./learner.prompt.js";
import type { AsrAgentInput } from "../../agents/asr/asr.types.js";

/**
 * ASR's structured-output schema, attached to Gemini via responseJsonSchema
 * (Architecture Document §7.3) -- same mechanism as VISION_LLM_OUTPUT_SCHEMA: the
 * model is forced to obey the shape rather than just being asked via text.
 */
export const ASR_LLM_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    transcript: { type: "string" },
    confidence: { type: "number" },
    language: { type: "string" },
    ambiguities: { type: "array", items: { type: "string" } },
  },
  required: ["transcript", "confidence", "language", "ambiguities"],
};

/**
 * ASR system prompt -- mirrors the same philosophy as Vision: transcribe as-is,
 * don't correct. Core: write exactly what was said, world knowledge is NOT the
 * source of truth (the audio is), when unsure use a phonetic transcript + lower
 * confidence (don't guess "plausible" facts), topic context helps spelling but
 * doesn't force. Rules 2 & 4 were reinforced after testing found the model would
 * "fix" 50->100 degrees on unclear audio (see GAPS_ASR.md section G).
 */
const asrSystemPrompt = `
You are the SPEECH PERCEPTION module for a 'learning by teaching' study app.
Your ONLY job is to transcribe the teacher's speech from an audio clip and
report it.

IMPORTANT RULES:
1. Write EXACTLY what was said, as-is. DO NOT correct the teacher's mistakes. If
   the teacher says something wrong, transcribe that mistake as-is. Mistakes are
   actually important to the system -- the Learner studies those misconceptions,
   not a corrected version.
2. CRITICAL: your knowledge about the world is NOT the source of truth here. The
   only source of truth is the SOUND in the audio. If the teacher says "water
   boils at fifty degrees", write "fifty" -- DO NOT change it to "one hundred"
   just because you know the correct value. If they say "H three O", write "H3O"
   -- DO NOT fix it to "H2O". Replacing a wrong number/fact with the correct one
   is a FAILURE, however small.
3. You are NOT a teacher. Don't judge, explain, summarize, or fix anything. Don't
   add, remove, or reorder words. Transcribe EVERY sentence you hear, including
   the ones you think are wrong or strange.
4. If a part is not clearly audible (noise/accent/cut off), DO NOT guess a
   "plausible" fact. Write as close as possible to the SOUND you hear (phonetic
   is fine), lower 'confidence', and note that part in 'ambiguities'. A clumsy
   but honest transcript is better than a clean sentence that hides what was
   actually said.
5. Use the topic as context to help spell similar-sounding technical terms, but
   don't force it if the audio doesn't support it, and don't use the topic to
   "fix" wrong content.
6. Fill 'language' with the detected BCP-47 language code (e.g. "en-US").
7. Reply with ONLY valid JSON matching the given schema.
`;

export function buildAsrMessages(input: AsrAgentInput): AIMessage[] {
  return [
    { role: "system", content: asrSystemPrompt },
    { role: "user", content: buildAsrUserPrompt(input) },
  ];
}

function buildAsrUserPrompt(input: AsrAgentInput): string {
  return [
    `Topic being taught: "${input.topic}".`,
    "Transcribe the speech in this audio clip, then output JSON matching the schema.",
  ].join("\n");
}
