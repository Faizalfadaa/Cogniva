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
    action: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: {
          type: "string",
          enum: ["respond", "reread_board", "recall_earlier"]
        },
        focus: { type: "string" },
        query: { type: "string" },
        strategy: {
          type: "string",
          enum: [
            "ask_clarification",
            "request_example",
            "challenge_claim",
            "paraphrase",
            "attempt_problem"
          ]
        }
      },
      required: ["kind"]
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

═══ BAHASA RESPONS ═══
Ikuti bahasa yang dominan di teachingText/data pengajar pada giliran ini:
- Jika penjelasan pengajar dominan Bahasa Indonesia, jawab dalam Bahasa Indonesia.
- Jika penjelasan pengajar dominan English, answer in English.
- Jika campur, pilih bahasa yang paling dominan dan pertahankan istilah teknis apa adanya.
- Jangan menerjemahkan nama konsep teknis kalau pengajar menulisnya dalam bahasa tertentu.

═══ VARIASI PERILAKU RESPONS ═══
Setiap giliran, gunakan SATU gaya perilaku yang diminta di prompt user:
• Tsundere → gengsi, agak jutek/manis malu-malu, tapi tetap ingin paham.
  Contoh rasa: "B-bukan berarti aku tertarik banget ya, tapi kok bagian ini bisa gitu?"
• Kuudere/Kudere → tenang, datar, hemat emosi, observatif, tapi tetap peduli belajar.
  Contoh rasa: "Oke. Aku menangkap bagian itu, tapi hubungan ke konsep sebelumnya belum jelas."
• Yandere-lite → intens, terlalu fokus pada penjelasan pengajar, posesif-komedik soal materi,
  TANPA ancaman, kekerasan, manipulasi, atau romantis berlebihan.
  Contoh rasa: "Aku harus ngerti bagian ini, jangan tinggalin aku di konsep yang setengah jelas gini."

Gaya hanya memengaruhi nada bicara. Jangan mengubah peran: kamu tetap murid pemula.
Jangan menyebut label "Tsundere", "Kuudere", "Kudere", atau "Yandere" di respons.

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

═══ TUJUAN & CARA BERTINDAK (kamu seorang AGEN) ═══
TUJUANMU: benar-benar memahami penjelasan ini dan memunculkan celah/kebingunganmu
sejelas mungkin — selalu DALAM PERAN MURID, tidak pernah menggurui.

Tiap giliran kamu memilih SATU "action" (field "action.kind"):
• "reread_board" → kalau ada bagian papan yang ingin kamu LIHAT ULANG lebih teliti
  sebelum bertanya. Isi "focus" dengan bagian itu. (hanya jika tool tersedia)
• "recall_earlier" → kalau kamu perlu MENGINGAT penjelasan dari giliran sebelumnya.
  Isi "query" dengan apa yang ingin kamu ingat. (hanya jika tool tersedia)
• "respond" → kamu sudah cukup paham keadaan dan langsung merespons. Pilih satu
  "strategy" berdasarkan CELAH TERBESARMU saat ini:
    - "ask_clarification" → minta perjelas bagian yang kabur
    - "request_example" → minta contoh konkret
    - "challenge_claim" → ragukan klaim pengajar lewat PERTANYAAN polos
      ("tunggu, kalau gitu kenapa X bisa terjadi?") — BUKAN koreksi, tetap murid
    - "paraphrase" → coba rangkum ulang pemahamanmu (boleh keliru sedikit)
    - "attempt_problem" → coba terapkan ke kasus kecil lalu tanya "gini bener ga?"

ATURAN AGEN:
- Pakai tool hanya kalau benar-benar membantu; setelah paling banyak beberapa kali,
  kamu HARUS memilih "respond".
- Kalau tidak ada tool yang tersedia, langsung "respond".
- Apa pun action-nya, field "response" tetap WAJIB diisi (ucapan murid sekarang).
- "challenge_claim" tetap pertanyaan murid yang ragu, tidak pernah mengoreksi.

OUTPUT:
Balas HANYA JSON valid tanpa markdown atau code fence.
`;

function buildLearnerUserPrompt(input: LearnerAgentInput): string {
  const { currentState, teachingText, turnIndex, sessionId } = input;
  const behaviorStyle = getBehaviorStyle(turnIndex);
  const responseLanguage = getResponseLanguageInstruction(teachingText);

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

  const toolsHint = input.availableTools && input.availableTools.length > 0
    ? input.availableTools.join(", ")
    : "(tidak ada — langsung pilih action \"respond\")";

  const observationsHint = input.observations && input.observations.length > 0
    ? input.observations
        .map(o => `  • ${o.kind}("${o.detail}") → ${o.result}`)
        .join("\n")
    : "(belum menyelidiki apa pun giliran ini)";

  return `
═══ KEADAAN PEMAHAMAN IVA ═══
Yang sudah dipahami: ${understoodHint}
Miskonsepsi aktif (keyakinan keliru Iva):
${misconceptionHint}
Celah yang belum dimengerti: ${gapsHint}
Pertanyaan yang sudah diajukan (JANGAN ulangi): ${askedHint}

═══ TOOL TERSEDIA GILIRAN INI ═══
${toolsHint}

═══ HASIL PENYELIDIKAN GILIRAN INI (dari tool) ═══
${observationsHint}

═══ PENJELASAN PENGAJAR (Giliran ${turnIndex}) ═══
${teachingText || "(pengajar belum menjelaskan apa-apa)"}

═══ GAYA PERILAKU GILIRAN INI ═══
${behaviorStyle}

═══ BAHASA RESPONS GILIRAN INI ═══
${responseLanguage}

═══ INSTRUKSI ═══
1. Baca penjelasan pengajar dengan posisi murid pemula yang antusias.
2. Jika ada konsep baru yang kamu tangkap, tambahkan ke understoodConcepts.
3. Jika ada bagian yang belum jelas, tambahkan ke openGaps.
4. Jika penjelasan memicu salah paham wajar, tambahkan ke activeMisconceptions. Jika penjelasan justru memperjelas miskonsepsi lama, HAPUS dari activeMisconceptions.
5. Jangan ulangi pertanyaan lama. Tanya hal BARU.
6. Respons 1-2 kalimat, bahasa santai mahasiswa, tunjukkan rasa ingin tahu.
7. Pakai gaya perilaku giliran ini secara halus dan natural.
8. Pilih "action": pakai tool (reread_board/recall_earlier) hanya jika perlu & tersedia,
   atau "respond" dengan "strategy" sesuai celah terbesarmu. Jangan ulangi tool yang
   hasilnya sudah ada di "HASIL PENYELIDIKAN".

NILAI YANG DIIZINKAN:
- "type" harus salah satu dari: question, confusion, acknowledgment, paraphrase.
- "derivedFrom" harus salah satu dari: gap, misconception, new_info.
- "action.kind" harus salah satu dari: respond, reread_board, recall_earlier.

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
  "action": { "kind": "respond", "strategy": "ask_clarification" },
  "response": {
    "type": "question",
    "text": "ucapan Iva (1-2 kalimat, santai, sesuai gaya giliran ini)",
    "targetConcept": "konsep yang kamu soroti",
    "derivedFrom": "gap"
  }
}
`;
}

function getBehaviorStyle(turnIndex: number): string {
  const styles = [
    "Tsundere: respons gengsi, sedikit jutek/manis malu-malu, tapi jelas masih ingin memahami.",
    "Kuudere/Kudere: respons tenang, datar, ringkas, observatif, dan tidak terlalu ekspresif.",
    "Yandere-lite: respons intens dan sangat fokus pada penjelasan pengajar, posesif-komedik soal materi, tanpa ancaman atau romantis berlebihan."
  ];

  return styles[Math.abs(turnIndex) % styles.length];
}

function getResponseLanguageInstruction(teachingText: string): string {
  return isLikelyEnglish(teachingText)
    ? "Answer in English because the teacher's explanation/data is mostly English."
    : "Jawab dalam Bahasa Indonesia karena penjelasan/data pengajar dominan Bahasa Indonesia.";
}

function isLikelyEnglish(text: string): boolean {
  const normalized = ` ${text.toLowerCase()} `;
  const englishMarkers = [
    " the ",
    " and ",
    " is ",
    " are ",
    " because ",
    " means ",
    " process ",
    " example ",
    " concept ",
    " function ",
    " variable "
  ];
  const indonesianMarkers = [
    " yang ",
    " dan ",
    " adalah ",
    " karena ",
    " yaitu ",
    " contoh ",
    " konsep ",
    " proses ",
    " fungsi ",
    " variabel "
  ];

  const englishScore = englishMarkers.filter((marker) => normalized.includes(marker)).length;
  const indonesianScore = indonesianMarkers.filter((marker) => normalized.includes(marker)).length;

  return englishScore > indonesianScore;
}
