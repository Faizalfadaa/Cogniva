import type { VisionAgentInput, VisionLLMOutput } from "./vision.types.js";

/**
 * Mock deterministik -- dipakai test dan demo offline (tanpa API key,
 * tanpa jaringan), sama perannya dengan mockLearnerAI. TIDAK membaca gambar
 * sungguhan; hanya menghasilkan bentuk yang valid agar pipeline (guard,
 * pemetaan kontrak, orchestrator) bisa diuji tanpa memanggil model nyata.
 */
export function mockVisionAI(input: VisionAgentInput): VisionLLMOutput {
  if (!input.imageBase64) {
    return {
      transcript: "",
      elements: [],
      overallConfidence: 0,
      ambiguities: ["tidak ada gambar untuk dibaca (mock)"],
      needsConfirmation: true,
      confirmationPrompt: "Belum ada gambar papan. Bisa tulis atau ketik dulu?",
    };
  }

  return {
    transcript: `(mock) papan tentang ${input.topic}`,
    elements: [
      {
        kind: "text",
        content: `(mock) ${input.topic}`,
        confidence: 1,
        location: "tengah",
      },
    ],
    overallConfidence: 1,
    ambiguities: [],
    needsConfirmation: false,
  };
}
