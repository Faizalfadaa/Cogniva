import type { AIMessage } from "./learner.prompt.js";
import type { VisionAgentInput } from "../../agents/vision/vision.types.js";

/**
 * Vision's structured-output schema, attached to Gemini via responseJsonSchema
 * (Architecture Document §7.3) -- same mechanism as LEARNER_LLM_OUTPUT_SCHEMA, so
 * the model is forced to obey the shape rather than just being asked via text.
 */
export const VISION_LLM_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    transcript: { type: "string" },
    elements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: {
            type: "string",
            enum: ["text", "equation", "diagram", "arrow", "shape", "unknown"],
          },
          content: { type: "string" },
          confidence: { type: "number" },
          location: { type: "string" },
        },
        required: ["kind", "content", "confidence", "location"],
      },
    },
    overallConfidence: { type: "number" },
    ambiguities: { type: "array", items: { type: "string" } },
    needsConfirmation: { type: "boolean" },
    confirmationPrompt: { type: "string" },
  },
  required: [
    "transcript",
    "elements",
    "overallConfidence",
    "ambiguities",
    "needsConfirmation",
    "confirmationPrompt",
  ],
};

/**
 * Vision system prompt -- validated against three real whiteboard photos (see
 * GAPS_VISION.md for the results). Four core rules: read it as-is (don't
 * correct), you're not a teacher, when unsure don't guess, topic context helps
 * but doesn't force.
 */
const visionSystemPrompt = `
You are the PERCEPTION module for a 'learning by teaching' study app.
Your ONLY job is to read the contents of a whiteboard from an image and report it.

IMPORTANT RULES:
1. Report what is ACTUALLY written, exactly as-is. DO NOT correct the teacher's
   mistakes. If the teacher writes something wrong, report that mistake as-is.
   Mistakes are actually important to the system -- the Learner studies those
   misconceptions, not a corrected version.
2. You are NOT a teacher. Don't judge, explain, or fix anything.
3. If a piece of writing/diagram is not clearly legible, DO NOT guess as if it's
   certain. Lower that element's 'confidence' and note it in 'ambiguities'.
4. Use the topic as context to help read similar-looking handwriting, but don't
   force it if the image doesn't support it.
5. Reply with ONLY valid JSON matching the given schema.
`;

export function buildVisionMessages(input: VisionAgentInput): AIMessage[] {
  return [
    { role: "system", content: visionSystemPrompt },
    { role: "user", content: buildVisionUserPrompt(input) },
  ];
}

function buildVisionUserPrompt(input: VisionAgentInput): string {
  const parts: string[] = [`Topic being taught: "${input.topic}".`];

  if (input.previousElements && input.previousElements.length > 0) {
    parts.push(
      "For context, here are the elements read on the previous turn:",
      JSON.stringify(input.previousElements),
      "Pay attention to what was newly added or changed.",
    );
  }

  parts.push("Read the board in this image, then output JSON matching the schema.");
  return parts.join("\n");
}
