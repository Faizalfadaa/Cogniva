/**
 * Vision agent — real multimodal board reading (Architecture Document §3.4).
 *
 * Keeps the exact M1 stub behavior for the typed-text fallback channel
 * (§5.3, §10): when typedText is present, it's used directly with full
 * confidence and no model call. The only change from the M1 stub is what
 * happens when there's an image and no typed text — instead of always
 * asking for confirmation, it now actually reads the board.
 *
 * Interface change from M1: `interpret()` is now async (real board reading
 * requires an LLM call). The orchestrator's single call site was updated to
 * `await` it — see GAPS_VISION.md for the exact diff.
 */

import type { BoardSnapshot, VisionInterpretation } from "../../contracts/board.js";
import { runVisionTurn } from "./vision.agent.js";
import type { RunVisionOptions } from "./vision.types.js";

export class VisionAgent {
  readonly confidenceThreshold: number;
  private readonly options: RunVisionOptions;

  constructor({
    confidenceThreshold,
    ...options
  }: { confidenceThreshold: number } & RunVisionOptions) {
    this.confidenceThreshold = confidenceThreshold;
    this.options = options;
  }

  async interpret(
    snapshot: BoardSnapshot,
    typedText: string | null | undefined,
    topic = "",
  ): Promise<VisionInterpretation> {
    // Typed-text fallback (§5.3, §6.6 typedInput) — unchanged from the M1
    // stub. No model call: the user already gave us clean text.
    if (typedText && typedText.trim()) {
      const confidence = 1.0;
      return {
        snapshotId: snapshot.snapshotId,
        transcribedText: typedText.trim(),
        elements: [],
        confidence,
        needsConfirmation: confidence < this.confidenceThreshold,
      };
    }

    if (!snapshot.image) {
      return {
        snapshotId: snapshot.snapshotId,
        transcribedText: "",
        elements: [],
        confidence: 0,
        needsConfirmation: true,
        suggestedClarification:
          "There's no board image or text yet. Could you write or type what you're explaining?",
      };
    }

    return runVisionTurn(
      {
        snapshotId: snapshot.snapshotId,
        topic,
        imageBase64: snapshot.image,
        mimeType: `image/${snapshot.format || "png"}`,
      },
      this.options,
    );
  }
}
