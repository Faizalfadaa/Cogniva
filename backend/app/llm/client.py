"""Gemini LLM wrapper (Architecture Document §3.3, §7.3).

A thin, centralized layer so every agent calls the model the same way:
uniform model id, timeout, retries (handled by the SDK), and structured-JSON
output parsing. Agents never import the Google GenAI SDK directly — they go
through this wrapper, which keeps the model provider swappable behind one seam.

Structured output uses Gemini's JSON mode: `response_mime_type="application/json"`
plus `response_json_schema`, so the model is constrained to emit a JSON object
conforming to the caller's schema. The config is passed as a plain dict so this
works regardless of the installed SDK version's typed surface.
"""

from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger("cogniva.llm")


class LLMError(Exception):
    """A recoverable failure from the LLM layer (callers fall back)."""


class LLMClient:
    """Wraps a synchronous Gemini client and returns parsed JSON objects."""

    def __init__(self, *, model: str, max_tokens: int, timeout: float) -> None:
        from google import genai  # lazy import: skeleton runs even if SDK is absent

        self._genai = genai
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        # http_options.timeout is in milliseconds.
        self._client = genai.Client(
            api_key=api_key,
            http_options={"timeout": int(timeout * 1000)},
        )
        self.model = model
        self.max_tokens = max_tokens

    def structured(self, *, system: str, user: str, schema: dict) -> dict:
        """Call the model and return a JSON object conforming to `schema`.

        Raises LLMError on any failure (network, safety block, bad JSON) so the
        caller can fall back gracefully.
        """
        config = {
            "system_instruction": system,
            "max_output_tokens": self.max_tokens,
            "response_mime_type": "application/json",
            "response_json_schema": schema,
        }
        try:
            response = self._client.models.generate_content(
                model=self.model,
                contents=user,
                config=config,
            )
        except Exception as exc:  # noqa: BLE001 - normalize to LLMError
            raise LLMError(f"LLM request failed: {exc}") from exc

        # A safety block (or other non-STOP finish) yields no usable text.
        feedback = getattr(response, "prompt_feedback", None)
        if feedback is not None and getattr(feedback, "block_reason", None):
            raise LLMError(f"model blocked the request: {feedback.block_reason}")

        try:
            text = response.text
        except Exception as exc:  # noqa: BLE001 - .text raises when no text part
            raise LLMError(f"model returned no text content: {exc}") from exc
        if not text:
            raise LLMError("model returned no text content")

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise LLMError(f"model returned invalid JSON: {exc}") from exc
