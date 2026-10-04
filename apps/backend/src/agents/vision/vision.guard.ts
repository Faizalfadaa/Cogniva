import { defaultClarification } from "../shared/clarification.js";
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
 * Mapping from the internal kind -> the official ElementType (contracts/enums.ts).
 * "shape" and "unknown" have no official counterpart -- see GAPS_VISION.md point 1.
 * "shape" maps to "figure" (closest in meaning); "unknown" maps to "text" as the
 * most neutral default. The "this is genuinely unreadable" signal still survives
 * via needsConfirmation/suggestedClarification at the VisionInterpretation level,
 * even though it's lost at the individual Element level.
 */
const KIND_TO_ELEMENT_TYPE: Record<VisionElementKind, ElementType> = {
  text: "text",
  equation: "equation",
  diagram: "diagram",
  arrow: "arrow",
  shape: "figure",
  unknown: "text",
};

/** Parse the raw output from LLMClient.structured() (already a JSON object, not
 * text) into a safe-to-use VisionLLMOutput -- every field is validated/defaulted,
 * never trusting the model's shape blindly. */
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

/** Mapping to the official VisionInterpretation contract. Per-element
 * `confidence` now survives the mapping, so one smudged element can be told
 * apart from a clean one even when overallConfidence is high. `bbox` is still
 * left unset on purpose -- see the note below. */
export function toVisionInterpretation(
  output: VisionLLMOutput,
  snapshotId: string,
  threshold: number,
): VisionInterpretation {
  const elements: Element[] = output.elements.map((e) => ({
    type: KIND_TO_ELEMENT_TYPE[e.kind],
    content: e.content,
    // bbox is intentionally left unset: the vision model used doesn't return
    // precise pixel coordinates from a text-position description, only a rough
    // `location` hint that has no field in the official contract yet.
    confidence: e.confidence,
  }));

  const needsConfirmation =
    output.needsConfirmation ||
    output.overallConfidence < threshold ||
    output.ambiguities.length > 0;

  let suggestedClarification = output.confirmationPrompt;
  if (needsConfirmation && !suggestedClarification) {
    suggestedClarification = defaultClarification(output.ambiguities, "board");
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

/** Safe result when the LLM call fails completely (network, invalid JSON, etc.).
 * Never drops the turn -- it always asks the user to clarify, consistent with the
 * "don't guess when unsure" invariant (§3.4). */
export function createFallbackInterpretation(snapshotId: string): VisionInterpretation {
  return {
    snapshotId,
    transcribedText: "",
    elements: [],
    confidence: 0,
    needsConfirmation: true,
    suggestedClarification:
      "The board can't be read right now. Could you rewrite it more clearly or type the main points?",
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

export { VisionAgentInput };
