import type { Element, VisionInterpretation } from "../../contracts/board.js";

/** The richer shape requested from the model -- per-element confidence and
 * explicit ambiguities -- more detailed than the official VisionInterpretation
 * (see GAPS_VISION.md points 1-2 for why these two signals don't all survive
 * after mapping to the official contract). */
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
  /** Base64 (no data: prefix) or an empty string when there's no image. */
  imageBase64: string;
  mimeType: string;
  /** Previous turn's result, for incremental-reading context (optional). */
  previousElements?: Element[];
};

export type RunVisionOptions = {
  /** Force mock mode (used by tests and offline demos). */
  useMock?: boolean;
  /**
   * Reports this turn's token cost back to the orchestrator (§7.3). Optional:
   * agents run exactly as before when nobody is counting.
   */
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
};

export { type Element, type VisionInterpretation };
