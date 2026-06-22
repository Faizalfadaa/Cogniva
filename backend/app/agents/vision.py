"""Vision agent — M1 passthrough stub (Architecture Document §3.4).

In M1 there is no real board reading yet; the teaching content arrives as the
typed-text channel (the structured fallback §10 mandates). This stub turns that
typed text into a VisionInterpretation so the end-to-end loop runs. When only an
image is provided (no typed text), it can't read it yet and asks the user to
confirm by typing — exercising the confirmation path (§5.3) end to end.

Real multimodal board reading replaces this in M2; the contract it returns
(VisionInterpretation) does not change.
"""

from __future__ import annotations

from ..contracts.board import BoardSnapshot, VisionInterpretation


class VisionAgent:
    def __init__(self, *, confidence_threshold: float) -> None:
        self.confidence_threshold = confidence_threshold

    def interpret(
        self, snapshot: BoardSnapshot, typed_text: str | None
    ) -> VisionInterpretation:
        if typed_text and typed_text.strip():
            confidence = 1.0
            return VisionInterpretation(
                snapshot_id=snapshot.snapshot_id,
                transcribed_text=typed_text.strip(),
                elements=[],
                confidence=confidence,
                needs_confirmation=confidence < self.confidence_threshold,
                suggested_clarification=None,
            )

        # TODO(M2): call a multimodal model to read the whiteboard image.
        confidence = 0.0
        return VisionInterpretation(
            snapshot_id=snapshot.snapshot_id,
            transcribed_text="",
            elements=[],
            confidence=confidence,
            needs_confirmation=confidence < self.confidence_threshold,
            suggested_clarification=(
                "Board reading isn't enabled yet (coming in M2). Please type "
                "what you wrote or explained so the student can follow along."
            ),
        )
