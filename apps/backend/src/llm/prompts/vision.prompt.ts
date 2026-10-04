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
5. Describe a picture by what it visibly shows: who or what is in it and what
   is happening ("a woman pours water from a jug into a glass"). Name a person
   only when the board labels them; don't guess identities from the topic.
6. When the board is laid out in side-by-side columns, first decide which
   column each item belongs to by its HORIZONTAL position, then read the
   columns left to right, each from top to bottom. A heading that sits above
   one column belongs to THAT column, so it goes right before that column's
   content, even when it is the highest item on the whole board. Order both
   the "elements" list and the "transcript" this way.
7. Reply with ONLY valid JSON matching the given schema.
`;

export function buildVisionMessages(input: VisionAgentInput): AIMessage[] {
  return [
    { role: "system", content: visionSystemPrompt },
    { role: "user", content: buildVisionUserPrompt(input) },
  ];
}

function buildVisionUserPrompt(input: VisionAgentInput): string {
  const parts: string[] = [`Topic being taught: "${input.topic}".`];

  // The previous reading is a reading aid only. It used to come with "pay
  // attention to what was newly added", and the model took that as "report
  // only what is new": on a real three-column board it dropped the first
  // column in 2 of 3 runs, and 0 of 3 with no previous reading at all. What
  // is new is read separately now (VisionInterpretation.newText), so this
  // reading has one job, the whole board.
  if (input.previousElements && input.previousElements.length > 0) {
    parts.push(
      "For reference, here are the elements read from this board on the previous turn.",
      "Use them only to read the same handwriting consistently:",
      JSON.stringify(input.previousElements),
      "Your reading must still cover EVERYTHING on the board now, including every element",
      "that was already there on the previous turn. Do not leave out old content.",
    );
  }

  parts.push("Read the whole board in this image, then output JSON matching the schema.");
  return parts.join("\n");
}
