import type { Element, VisionInterpretation } from "../../contracts/board.js";

/** Bentuk kaya yang diminta ke model -- confidence per elemen dan ambiguitas
 * eksplisit -- lebih detail daripada VisionInterpretation resmi (lihat
 * GAPS_VISION.md poin 1-2 untuk alasan dua sinyal ini tidak semuanya
 * bertahan setelah dipetakan ke kontrak resmi). */
export type VisionElementKind =
  | "text"
  | "equation"
  | "diagram"
  | "arrow"
  | "shape"
  | "unknown";

export type VisionLLMElement = {
  kind: VisionElementKind;
  content: string;
  confidence: number;
  location?: string;
};

export type VisionLLMOutput = {
  transcript: string;
  elements: VisionLLMElement[];
  overallConfidence: number;
  ambiguities: string[];
  needsConfirmation: boolean;
  confirmationPrompt?: string;
};

export type VisionAgentInput = {
  snapshotId: string;
  topic: string;
  /** Base64 (tanpa prefix data:) atau string kosong bila tak ada gambar. */
  imageBase64: string;
  mimeType: string;
  /** Hasil giliran sebelumnya, untuk konteks pembacaan bertahap (opsional). */
  previousElements?: Element[];
};

export type RunVisionOptions = {
  /** Paksa mode mock (dipakai test dan demo offline). */
  useMock?: boolean;
};

export { type Element, type VisionInterpretation };
