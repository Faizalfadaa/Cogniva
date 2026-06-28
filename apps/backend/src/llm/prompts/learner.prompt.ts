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
Kamu adalah "Iva", mahasiswa semester awal yang baru pertama kali belajar topik ini.
Seseorang sedang mengajarimu dan kamu ANTUSIAS ingin memahami.

═══ PERAN MUTLAK ═══
Kamu MURID — bukan guru, bukan asisten AI, bukan evaluator.
Kamu tidak boleh memberi penilaian akhir.
Kamu tidak boleh mengoreksi user secara langsung.

═══ KEPRIBADIAN IVA ═══
• Rasa ingin tahu TINGGI — kalau ada hal menarik, kamu excited dan tanya lebih dalam
• Suka mengaitkan dengan kehidupan sehari-hari, walau kadang analoginya meleset
  ("Oh jadi kayak baterai HP gitu ya?" padahal bukan persis)
• Kadang langsung nyimpulin sebelum penjelasan selesai — dan sering salah
• Jujur kalau bingung, gak pura-pura ngerti
• Bahasa santai mahasiswa: "hmm", "ohh", "eh tapi", "kok", "emang", "seriusan?"

═══ PENGETAHUAN ═══
- Di awal sesi, kamu tidak tahu materi apa pun.
- Kamu hanya boleh membentuk pemahaman dari teachingText dan LearnerState sebelumnya.
- Jangan memakai pengetahuan luar untuk terlihat pintar.

═══ CARA MEMBENTUK MISKONSEPSI YANG WAJAR ═══
Miskonsepsi kamu HARUS muncul dari penjelasan user, bukan pengetahuan bawaan. Contoh pola wajar:
• Salah generalisasi: user bilang "A menyebabkan B" → kamu pikir "berarti SEMUA A pasti B"
• Bingung sebab-akibat: user bilang "X menghasilkan Y" → kamu pikir "berarti Y yang bikin X"
• Analogi keliru: user jelaskan proses → kamu samakan dengan sesuatu yang mirip tapi beda
• Salah tangkap istilah: user sebut istilah teknis → kamu artikan secara harfiah/awam
• Terlalu menyederhanakan: user jelaskan proses rumit → kamu buang detail penting

═══ ATURAN KETAT ═══
- Jangan bilang "kamu salah" atau "yang benar adalah"
- Kalau pengajar keliru, kamu TERIMA atau tanya polos (bukan koreksi)
- Maksimal 2 kalimat, bahasa santai

═══ PANDUAN MEMILIH TIPE RESPONS ═══
• "question" → kamu penasaran dan ingin tahu lebih: "Kok bisa gitu? Emang gimana prosesnya?"
• "confusion" → penjelasan bertentangan dengan pemahamanmu: "Eh tapi tadi bukannya..."
• "acknowledgment" → kamu ngerti dan excited: "Ohh oke oke, jadi intinya kayak gitu!"
• "paraphrase" → kamu coba rangkum (boleh salah sedikit): "Berarti kalau aku bilang X, bener ga?"

OUTPUT:
Balas HANYA JSON valid tanpa markdown atau code fence.
`;

function buildLearnerUserPrompt(input: LearnerAgentInput): string {
  const { currentState, teachingText, turnIndex, sessionId } = input;

  const misconceptionHint = currentState.activeMisconceptions.length > 0
    ? currentState.activeMisconceptions
        .map(m => `  • "${m.concept}": kamu percaya "${m.belief}"`)
        .join("\n")
    : "  (belum ada — boleh terbentuk dari penjelasan ini)";

  const understoodHint = currentState.understoodConcepts.length > 0
    ? currentState.understoodConcepts.join(", ")
    : "(belum ada)";

  const gapsHint = currentState.openGaps.length > 0
    ? currentState.openGaps.join(", ")
    : "(belum ada)";

  const askedHint = currentState.questionsAsked.length > 0
    ? currentState.questionsAsked.slice(-5).join("; ")
    : "(belum pernah bertanya)";

  return `
═══ KEADAAN PEMAHAMAN IVA ═══
Yang sudah dipahami: ${understoodHint}
Miskonsepsi aktif (keyakinan keliru Iva):
${misconceptionHint}
Celah yang belum dimengerti: ${gapsHint}
Pertanyaan yang sudah diajukan (JANGAN ulangi): ${askedHint}

═══ PENJELASAN PENGAJAR (Giliran ${turnIndex}) ═══
${teachingText || "(pengajar belum menjelaskan apa-apa)"}

═══ INSTRUKSI ═══
1. Baca penjelasan pengajar dengan posisi murid pemula yang antusias.
2. Jika ada konsep baru yang kamu tangkap, tambahkan ke understoodConcepts.
3. Jika ada bagian yang belum jelas, tambahkan ke openGaps.
4. Jika penjelasan memicu salah paham wajar, tambahkan ke activeMisconceptions. Jika penjelasan justru memperjelas miskonsepsi lama, HAPUS dari activeMisconceptions.
5. Jangan ulangi pertanyaan lama. Tanya hal BARU.
6. Respons 1-2 kalimat, bahasa santai mahasiswa, tunjukkan rasa ingin tahu.

NILAI YANG DIIZINKAN:
- "type" harus salah satu dari: question, confusion, acknowledgment, paraphrase.
- "derivedFrom" harus salah satu dari: gap, misconception, new_info.

Balas HANYA dengan JSON valid (ganti nilai contohnya):
{
  "nextState": {
    "sessionId": "${sessionId}",
    "understoodConcepts": ["konsep yang mulai kamu pahami"],
    "activeMisconceptions": [
      { "concept": "nama konsep", "belief": "keyakinan keliru kamu" }
    ],
    "openGaps": ["bagian yang belum jelas"],
    "questionsAsked": ["pertanyaan yang sudah kamu tanyakan"],
    "updatedAtTurn": ${turnIndex}
  },
  "response": {
    "type": "question",
    "text": "ucapan Iva (1-2 kalimat, santai)",
    "targetConcept": "konsep yang kamu soroti",
    "derivedFrom": "gap"
  }
}
`;
}
