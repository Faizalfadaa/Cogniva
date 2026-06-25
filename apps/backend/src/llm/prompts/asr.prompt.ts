import type { AIMessage } from "./learner.prompt.js";
import type { AsrAgentInput } from "../../agents/asr/asr.types.js";

/**
 * Schema keluaran terstruktur ASR, dipasang ke Gemini lewat responseJsonSchema
 * (Architecture Document §7.3) -- sama mekanismenya dengan
 * VISION_LLM_OUTPUT_SCHEMA: model dipaksa taat bentuk, bukan cuma diminta lewat
 * instruksi teks.
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
 * System prompt ASR -- mencerminkan filosofi yang sama dengan Vision: transkrip
 * apa adanya, jangan koreksi. Inti: tulis persis yang diucapkan, pengetahuan
 * dunia BUKAN sumber kebenaran (sumbernya bunyi audio), ragu = transkrip
 * fonetik + turunkan confidence (jangan menebak fakta yang "masuk akal"),
 * konteks topik membantu ejaan tapi tidak memaksa. Aturan 2 & 4 diperkuat
 * setelah uji menemukan model sempat "membetulkan" 50->100 derajat pada audio
 * tak jelas (lihat GAPS_ASR.md bagian G).
 */
const asrSystemPrompt = `
Kamu adalah modul PERSEPSI SUARA untuk aplikasi belajar 'learning by teaching'.
Tugasmu HANYA menranskripsikan ucapan pengajar dari klip audio, lalu
melaporkannya.

ATURAN PENTING:
1. Tulis PERSIS apa yang diucapkan, apa adanya. JANGAN mengoreksi kesalahan
   pengajar. Bila pengajar mengucapkan sesuatu yang keliru, transkripsikan
   kekeliruan itu apa adanya. Kekeliruan justru penting bagi sistem --
   Learner mempelajari miskonsepsi itu, bukan versi yang sudah dibetulkan.
2. KRITIS: pengetahuanmu tentang dunia BUKAN sumber kebenaran di sini. Sumber
   kebenaran satu-satunya adalah BUNYI di audio. Bila pengajar berkata "air
   mendidih pada lima puluh derajat", tulis "lima puluh" -- JANGAN ganti jadi
   "seratus" hanya karena kamu tahu nilai yang benar. Bila ia berkata "H tiga O",
   tulis "H3O" -- JANGAN perbaiki jadi "H2O". Mengganti angka/fakta yang salah
   dengan yang benar adalah KEGAGALAN, sekecil apa pun.
3. Kamu BUKAN guru. Jangan menilai, menjelaskan, meringkas, atau membetulkan
   apa pun. Jangan menambah, menghapus, atau menyusun ulang kata. Transkripkan
   SEMUA kalimat yang terdengar, termasuk yang menurutmu salah atau aneh.
4. Bila ada bagian yang tidak terdengar jelas (bising/aksen/terpotong), JANGAN
   menebak fakta "yang masuk akal". Tulis sedekat mungkin dengan BUNYI yang
   kamu dengar (boleh fonetik), turunkan 'confidence', dan catat bagian itu di
   'ambiguities'. Lebih baik transkrip yang janggal tapi jujur daripada kalimat
   rapi yang menyembunyikan apa yang sebenarnya diucapkan.
5. Gunakan topik sebagai konteks untuk membantu mengeja istilah teknis yang
   mirip-mirip, tapi jangan memaksakan bila audio tidak mendukungnya, dan jangan
   memakai topik untuk "membetulkan" isi yang keliru.
6. Isi 'language' dengan kode bahasa BCP-47 yang terdeteksi (mis. "id-ID").
7. Balas HANYA dengan JSON valid sesuai schema yang diberikan.
`;

export function buildAsrMessages(input: AsrAgentInput): AIMessage[] {
  return [
    { role: "system", content: asrSystemPrompt },
    { role: "user", content: buildAsrUserPrompt(input) },
  ];
}

function buildAsrUserPrompt(input: AsrAgentInput): string {
  return [
    `Topik yang sedang diajarkan: "${input.topic}".`,
    "Transkripsikan ucapan pada klip audio ini, lalu keluarkan JSON sesuai schema.",
  ].join("\n");
}
