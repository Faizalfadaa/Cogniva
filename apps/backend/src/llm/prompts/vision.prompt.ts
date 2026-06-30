import type { AIMessage } from "./learner.prompt.js";
import type { VisionAgentInput } from "../../agents/vision/vision.types.js";

/**
 * Schema keluaran terstruktur Vision, dipasang ke Gemini lewat
 * responseJsonSchema (Architecture Document §7.3) -- sama mekanismenya
 * dengan LEARNER_LLM_OUTPUT_SCHEMA, supaya model dipaksa taat bentuk, bukan
 * cuma diminta lewat instruksi teks.
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
 * System prompt Vision -- sudah teruji dengan tiga foto papan tulis asli
 * (lihat GAPS_VISION.md untuk hasilnya). Empat aturan inti:
 * baca apa adanya (jangan koreksi), bukan guru, ragu = jangan menebak,
 * konteks topik membantu tapi tidak memaksa.
 */
const visionSystemPrompt = `
Kamu adalah modul PERSEPSI untuk aplikasi belajar 'learning by teaching'.
Tugasmu HANYA membaca isi sebuah papan tulis dari gambar, lalu melaporkannya.

ATURAN PENTING:
1. Laporkan apa yang BENAR-BENAR tertulis, apa adanya. JANGAN mengoreksi
   kesalahan pengajar. Bila pengajar menulis sesuatu yang keliru, laporkan
   kekeliruan itu apa adanya. Kekeliruan justru penting bagi sistem --
   Learner mempelajari miskonsepsi itu, bukan versi yang sudah dibetulkan.
2. Kamu BUKAN guru. Jangan menilai, menjelaskan, atau membetulkan apa pun.
3. Bila ada tulisan/diagram yang tidak terbaca jelas, JANGAN menebak seolah
   pasti. Turunkan 'confidence' elemen itu dan catat di 'ambiguities'.
4. Gunakan topik sebagai konteks untuk membantu membaca tulisan yang
   mirip-mirip, tapi jangan memaksakan bila gambar tidak mendukungnya.
5. Balas HANYA dengan JSON valid sesuai schema yang diberikan.
6. Tulis 'content' dan 'location' tiap elemen SINGKAT (beberapa kata, bukan
   kalimat penuh) -- misal "6CO2+6H2O->C6H12O6+6O2" bukan "persamaan kimia
   yang menunjukkan reaksi karbon dioksida dan air menjadi glukosa dan
   oksigen". Papan yang padat (banyak elemen) tetap harus pas dalam satu
   balasan; keringkasan per elemen menjaga itu tanpa mengurangi makna.
`;

export function buildVisionMessages(input: VisionAgentInput): AIMessage[] {
  return [
    { role: "system", content: visionSystemPrompt },
    { role: "user", content: buildVisionUserPrompt(input) },
  ];
}

function buildVisionUserPrompt(input: VisionAgentInput): string {
  const parts: string[] = [`Topik yang sedang diajarkan: "${input.topic}".`];

  if (input.previousElements && input.previousElements.length > 0) {
    parts.push(
      "Untuk konteks, ini elemen yang terbaca di giliran sebelumnya:",
      JSON.stringify(input.previousElements),
      "Perhatikan apa yang baru ditambahkan atau diubah.",
    );
  }

  parts.push("Baca papan pada gambar ini, lalu keluarkan JSON sesuai schema.");
  return parts.join("\n");
}
