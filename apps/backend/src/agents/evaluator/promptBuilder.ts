import { EvaluatorInput } from "./types";

export function buildEvaluatorPrompt(input: EvaluatorInput): string {
  const { turns, referenceMaterial, keyConcepts, commonMisconceptions } = input;

  const transcriptStr = turns
    .map((turn) => {
      let turnStr = `Turn ${turn.turnIndex}:\n`;
      if (turn.interpretation?.transcribedText) {
        turnStr += `Board Text: ${turn.interpretation.transcribedText}\n`;
      }
      if (turn.speechTranscript?.transcript) {
        turnStr += `Speech: ${turn.speechTranscript.transcript}\n`;
      }
      if (turn.typedInput) {
        turnStr += `Typed: ${turn.typedInput}\n`;
      }
      return turnStr;
    })
    .join("\n");

  return `
You are Cogniva Evaluator. In Cogniva, users learn by teaching an AI tutor.
Your task is to evaluate a learner's teaching session based on the provided transcript and reference material.

# Reference Material
${referenceMaterial}

# Key Concepts
${keyConcepts.map((kc) => `- ${kc}`).join("\n")}

# Common Misconceptions
${commonMisconceptions.map((cm) => `- ${cm}`).join("\n")}

# Session Transcript
${transcriptStr}

# Instructions
Evaluate the session and return ONLY valid JSON matching the following schema. Do not include evaluationId, sessionId, or generatedAt.
The schema is:
{
  "score": number, // 0 to 100
  "summary": string, // Overall evaluation summary
  "strengths": string[], // List of strengths
  "improvements": string[], // List of areas for improvement
  "findings": [
    {
      "category": "BENAR" | "KELIRU" | "TERLEWAT" | "MEMBINGUNGKAN",
      "concept": string, // The concept being addressed
      "detail": string, // Explanation of the finding
      "evidenceTurnIndex": number // The turnIndex from the transcript that supports this finding
    }
  ]
}

Finding Categories:
- BENAR: The learner correctly explained a concept.
- KELIRU: The learner explained a concept incorrectly.
- TERLEWAT: The learner missed a key concept.
- MEMBINGUNGKAN: The learner's explanation was confusing or unclear.

Ensure you cite the \`evidenceTurnIndex\` when referencing specific turns. Output strictly JSON.
`.trim();
}
