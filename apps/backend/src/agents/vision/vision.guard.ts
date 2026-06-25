import type { Element } from "../../contracts/board.js";
import type { ElementType } from "../../contracts/enums.js";
import type {
  VisionAgentInput,
  VisionElementKind,
  VisionInterpretation,
  VisionLLMElement,
  VisionLLMOutput,
} from "./vision.types.js";

const ALLOWED_KINDS: VisionElementKind[] = [
  "text",
  "equation",
  "diagram",
  "arrow",
  "shape",
  "unknown",
];

/**
 * Pemetaan kind internal -> ElementType resmi (contracts/enums.ts). "shape"
 * dan "unknown" tidak punya pasangan resmi -- lihat GAPS_VISION.md poin 1.
 * "shape" dipetakan ke "figure" (terdekat secara makna); "unknown" dipetakan
 * ke "text" sebagai default paling netral. Sinyal "ini genuinely tidak
 * terbaca" tetap bertahan lewat needsConfirmation/suggestedClarification di
 * level VisionInterpretation, walau hilang di level Element individual.
 */
const KIND_TO_ELEMENT_TYPE: Record<VisionElementKind, ElementType> = {
  text: "text",
  equation: "equation",
  diagram: "diagram",
  arrow: "arrow",
  shape: "figure",
  unknown: "text",
};

/** Parse keluaran mentah dari LLMClient.structured() (sudah berupa objek
 * JSON, bukan teks) jadi VisionLLMOutput yang aman dipakai -- setiap field
 * divalidasi/diberi default, tidak percaya bentuk dari model begitu saja. */
export function normalizeVisionLLMOutput(raw: Record<string, unknown>): VisionLLMOutput {
  const elements = Array.isArray(raw.elements)
    ? raw.elements.map(normalizeElement)
    : [];

  const overallConfidence =
    typeof raw.overallConfidence === "number"
      ? clamp01(raw.overallConfidence)
      : averageConfidence(elements);

  const ambiguities = Array.isArray(raw.ambiguities)
    ? raw.ambiguities.filter((a): a is string => typeof a === "string")
    : [];

  return {
    transcript: typeof raw.transcript === "string" ? raw.transcript : "",
    elements,
    overallConfidence,
    ambiguities,
    needsConfirmation: raw.needsConfirmation === true || ambiguities.length > 0,
    confirmationPrompt: nonEmptyString(raw.confirmationPrompt),
  };
}

/** Pemetaan ke kontrak resmi VisionInterpretation -- lossy di dua titik,
 * didokumentasikan di GAPS_VISION.md. */
export function toVisionInterpretation(
  output: VisionLLMOutput,
  snapshotId: string,
  threshold: number,
): VisionInterpretation {
  const elements: Element[] = output.elements.map((e) => ({
    type: KIND_TO_ELEMENT_TYPE[e.kind],
    content: e.content,
    // bbox sengaja tidak diisi: model vision yang dipakai tidak
    // mengembalikan koordinat piksel presisi dari deskripsi posisi teks.
  }));

  const needsConfirmation =
    output.needsConfirmation ||
    output.overallConfidence < threshold ||
    output.ambiguities.length > 0;

  let suggestedClarification = output.confirmationPrompt;
  if (needsConfirmation && !suggestedClarification) {
    suggestedClarification = defaultClarification(output.ambiguities);
  }

  return {
    snapshotId,
    transcribedText: output.transcript,
    elements,
    confidence: output.overallConfidence,
    needsConfirmation,
    suggestedClarification,
  };
}

/** Hasil aman saat panggilan LLM gagal total (network, JSON tak valid, dsb).
 * Tidak pernah menjatuhkan giliran -- selalu minta klarifikasi ke pengguna,
 * konsisten dengan invarian "jangan menebak saat ragu" (§3.4). */
export function createFallbackInterpretation(snapshotId: string): VisionInterpretation {
  return {
    snapshotId,
    transcribedText: "",
    elements: [],
    confidence: 0,
    needsConfirmation: true,
    suggestedClarification:
      "Papan belum bisa terbaca saat ini. Bisa tulis ulang lebih jelas atau ketik poin utamanya?",
  };
}

function normalizeElement(value: unknown): VisionLLMElement {
  const e = (value ?? {}) as Partial<VisionLLMElement>;
  const kind = ALLOWED_KINDS.includes(e.kind as VisionElementKind)
    ? (e.kind as VisionElementKind)
    : "unknown";

  return {
    kind,
    content: typeof e.content === "string" ? e.content : "",
    confidence: clamp01(typeof e.confidence === "number" ? e.confidence : 0),
    location: nonEmptyString(e.location),
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function averageConfidence(elements: VisionLLMElement[]): number {
  if (elements.length === 0) return 0;
  return elements.reduce((sum, e) => sum + e.confidence, 0) / elements.length;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function defaultClarification(ambiguities: string[]): string {
  if (ambiguities.length > 0) {
    return `Ada bagian yang kurang jelas: ${ambiguities.join("; ")}. Bisa diperjelas atau diketik?`;
  }
  return "Papan kurang terbaca jelas. Bisa tulis ulang lebih rapi atau ketik poin utamanya?";
}

export { VisionAgentInput };
