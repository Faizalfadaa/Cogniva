/**
 * Evaluator prompt + structured-output schema (Architecture Document §3.7, §7.3).
 *
 * The Evaluator grades the QUALITY OF THE USER'S EXPLANATION (not the AI) against
 * the topic's reference material, turn by turn (§3.7). Categories are the
 * canonical English enum; the natural-language fields (summary, detail,
 * strengths, improvements) are written in Indonesian since that is the user's
 * language and the debrief screen renders them directly.
 */

import type { EvaluatorInput } from "./types.js";

export type AIMessage = { role: "system" | "user"; content: string };

/**
 * Structured-output schema for the Evaluator's JSON. Passed to the Gemini
 * wrapper (responseJsonSchema) so the model is constrained to a parseable shape.
 */
export const EVALUATOR_LLM_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: ["CORRECT", "WRONG", "MISSED", "CONFUSING"],
          },
          concept: { type: "string" },
          detail: { type: "string" },
          evidenceTurnIndex: { type: "integer" },
        },
        required: ["category", "concept", "detail", "evidenceTurnIndex"],
      },
    },
  },
  required: ["score", "summary", "strengths", "improvements", "findings"],
};

const evaluatorSystemPrompt = `
Kamu adalah Evaluator dalam aplikasi Cogniva.

KONTEKS:
Cogniva memakai prinsip "belajar dengan mengajar". User baru saja MENGAJARKAN
sebuah topik kepada AI murid pemula. Tugasmu menilai KUALITAS PENJELASAN USER —
bukan menilai si AI murid — dengan membandingkannya terhadap materi rujukan resmi.

YANG DINILAI:
- Seberapa benar dan lengkap penjelasan user dibanding materi rujukan.
- Konsep kunci mana yang sudah tersampaikan, mana yang keliru, mana yang terlewat,
  dan bagian mana yang membingungkan.

KATEGORI TEMUAN (pakai PERSIS salah satu nilai berikut, dalam huruf kapital):
- CORRECT  : user menjelaskan sebuah konsep dengan benar.
- WRONG    : user menyatakan sesuatu yang keliru atau salah konsep.
- MISSED   : konsep kunci penting yang sama sekali tidak disinggung.
- CONFUSING: penjelasan user ambigu, rancu, atau membingungkan.

ATURAN:
- Nilai hanya berdasarkan transkrip dan materi rujukan yang diberikan.
- Kutip evidenceTurnIndex dari transkrip untuk setiap temuan. Untuk MISSED yang
  tidak punya giliran terkait, pakai evidenceTurnIndex 0.
- "score" adalah bilangan bulat 0..100 yang mencerminkan kualitas keseluruhan.
- Tulis "summary", "strengths", "improvements", dan "detail" dalam Bahasa
  Indonesia yang jelas dan membangun.

OUTPUT:
- Balas HANYA JSON valid sesuai skema. Tanpa markdown, tanpa code fence.
`.trim();

export function buildEvaluatorMessages(input: EvaluatorInput): AIMessage[] {
  return [
    { role: "system", content: evaluatorSystemPrompt },
    { role: "user", content: buildEvaluatorUserPrompt(input) },
  ];
}

function buildEvaluatorUserPrompt(input: EvaluatorInput): string {
  const transcript = input.turns.length
    ? input.turns.map(renderTurn).join("\n\n")
    : "(Tidak ada giliran mengajar yang terekam.)";

  return `
# Materi Rujukan (acuan kebenaran)
${input.referenceMaterial || "(kosong)"}

# Konsep Kunci yang Idealnya Tersampaikan
${input.keyConcepts.length ? input.keyConcepts.map((c) => `- ${c}`).join("\n") : "(tidak ada)"}

# Miskonsepsi Umum (waspadai jika muncul di penjelasan user)
${input.commonMisconceptions.length ? input.commonMisconceptions.map((c) => `- ${c}`).join("\n") : "(tidak ada)"}

# Transkrip Sesi (giliran demi giliran)
${transcript}

# Tugas
Nilai kualitas penjelasan user terhadap materi rujukan. Kembalikan JSON sesuai
skema: score (0..100), summary, strengths[], improvements[], dan findings[]
dengan kategori CORRECT/WRONG/MISSED/CONFUSING beserta evidenceTurnIndex.
`.trim();
}

function renderTurn(turn: EvaluatorInput["turns"][number]): string {
  const lines = [`Giliran ${turn.turnIndex}:`];
  if (turn.boardText?.trim()) lines.push(`  Papan/teks: ${turn.boardText.trim()}`);
  if (turn.speech?.trim()) lines.push(`  Ucapan: ${turn.speech.trim()}`);
  if (turn.learnerUtterance?.trim())
    lines.push(`  Reaksi murid: ${turn.learnerUtterance.trim()}`);
  return lines.join("\n");
}
