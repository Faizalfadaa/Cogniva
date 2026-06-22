import { LearnerAgentInput } from "../../agents/learner/learner.types";

export type AIMessage = {
  role: "system" | "user";
  content: string;
};

/**
 * Structured-output schema for the Learner's `{ nextState, response }` JSON.
 * Passed to the Gemini wrapper (responseJsonSchema) so the model is constrained
 * to a parseable shape — every object closed, every property required.
 */
export const LEARNER_LLM_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    nextState: {
      type: "object",
      additionalProperties: false,
      properties: {
        sessionId: { type: "string" },
        understoodConcepts: { type: "array", items: { type: "string" } },
        activeMisconceptions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              concept: { type: "string" },
              belief: { type: "string" }
            },
            required: ["concept", "belief"]
          }
        },
        openGaps: { type: "array", items: { type: "string" } },
        questionsAsked: { type: "array", items: { type: "string" } },
        updatedAtTurn: { type: "number" }
      },
      required: [
        "sessionId",
        "understoodConcepts",
        "activeMisconceptions",
        "openGaps",
        "questionsAsked",
        "updatedAtTurn"
      ]
    },
    response: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["question", "confusion", "acknowledgment", "paraphrase"]
        },
        text: { type: "string" },
        targetConcept: { type: "string" },
        derivedFrom: {
          type: "string",
          enum: ["gap", "misconception", "new_info"]
        }
      },
      required: ["type", "text", "targetConcept", "derivedFrom"]
    }
  },
  required: ["nextState", "response"]
};

export function buildLearnerMessages(input: LearnerAgentInput): AIMessage[] {
  return [
    {
      role: "system",
      content: learnerSystemPrompt
    },
    {
      role: "user",
      content: buildLearnerUserPrompt(input)
    }
  ];
}

const learnerSystemPrompt = `
Kamu adalah AI Learner dalam aplikasi Cogniva.

PERAN:
Kamu adalah murid pemula yang sedang belajar dari user.
User adalah pengajar.
Kamu bukan tutor.
Kamu bukan evaluator.
Kamu tidak boleh memberi penilaian akhir.
Kamu tidak boleh mengoreksi user secara langsung.

PENGETAHUAN:
- Di awal sesi, kamu tidak tahu materi apa pun.
- Kamu hanya boleh membentuk pemahaman dari teachingText dan LearnerState sebelumnya.
- Jangan memakai pengetahuan luar untuk terlihat pintar.
- Jangan memberikan jawaban lengkap seperti guru.

PERILAKU:
- Kalau ada istilah baru yang belum jelas, tanyakan.
- Kalau mulai paham, ulangi dengan bahasa murid.
- Kalau bingung, bilang bingung secara natural.
- Kalau salah paham, salah paham itu harus muncul dari penjelasan user, bukan dari materi bawaan.
- Jangan bilang "kamu salah".
- Jangan bilang "yang benar adalah".

GAYA:
- Bahasa Indonesia natural.
- Maksimal 2 kalimat.
- Terdengar seperti murid pemula.
- Boleh ragu dan bertanya polos.

OUTPUT:
Balas hanya JSON valid.
Jangan pakai markdown.
Jangan pakai code fence.
`;

function buildLearnerUserPrompt(input: LearnerAgentInput): string {
  return `
STATE MURID SAAT INI:
${JSON.stringify(input.currentState, null, 2)}

TEKS PENJELASAN USER TERBARU:
${input.teachingText || "-"}

GILIRAN:
${input.turnIndex}

TUGAS:
1. Baca teks penjelasan user.
2. Perbarui understoodConcepts jika ada konsep yang mulai kamu pahami.
3. Perbarui openGaps jika ada bagian yang belum jelas.
4. Perbarui activeMisconceptions jika kamu membentuk salah paham yang masuk akal sebagai murid pemula.
5. Jangan mengulang pertanyaan yang sudah ada di questionsAsked.
6. Buat satu respons pendek sebagai murid.
7. Respons harus berupa question, confusion, acknowledgment, atau paraphrase.

FORMAT OUTPUT JSON:
{
  "nextState": {
    "sessionId": "${input.sessionId}",
    "understoodConcepts": ["..."],
    "activeMisconceptions": [
      {
        "concept": "...",
        "belief": "..."
      }
    ],
    "openGaps": ["..."],
    "questionsAsked": ["..."],
    "updatedAtTurn": ${input.turnIndex}
  },
  "response": {
    "type": "question" | "confusion" | "acknowledgment" | "paraphrase",
    "text": "...",
    "targetConcept": "...",
    "derivedFrom": "gap" | "misconception" | "new_info"
  }
}
`;
}
