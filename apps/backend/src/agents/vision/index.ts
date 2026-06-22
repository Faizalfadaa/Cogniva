/**
 * Vision agent — M1 passthrough stub (Architecture Document §3.4).
 *
 * In M1 there is no real board reading yet; the teaching content arrives as the
 * typed-text channel (the structured fallback §10 mandates). This stub turns
 * that typed text into a VisionInterpretation so the end-to-end loop runs. When
 * only an image is provided (no typed text), it can't read it yet and asks the
 * user to confirm by typing — exercising the confirmation path (§5.3).
 *
 * Real multimodal board reading replaces this in M2; the contract it returns
 * (VisionInterpretation) does not change.
 */

import type { BoardSnapshot, VisionInterpretation } from "../../contracts/board.js";

export class VisionAgent {
  readonly confidenceThreshold: number;

  constructor({ confidenceThreshold }: { confidenceThreshold: number }) {
    this.confidenceThreshold = confidenceThreshold;
  }

  interpret(
    snapshot: BoardSnapshot,
    typedText: string | null | undefined,
  ): VisionInterpretation {
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

    // TODO(M2): call a multimodal model to read the whiteboard image.
    const confidence = 0.0;
    return {
      snapshotId: snapshot.snapshotId,
      transcribedText: "",
      elements: [],
      confidence,
      needsConfirmation: confidence < this.confidenceThreshold,
      suggestedClarification:
        "Board reading isn't enabled yet (coming in M2). Please type " +
        "what you wrote or explained so the student can follow along.",
    };
  }
}
