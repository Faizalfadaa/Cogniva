"""Anthropic LLM wrapper (Architecture Document §3.3, §7.3).

A thin, centralized layer so every agent calls the model the same way:
uniform model id, timeout, retries (handled by the SDK), and structured-JSON
output parsing. Agents never import the Anthropic SDK directly — they go
through this wrapper, which keeps the model provider swappable behind one seam.

Structured output uses the Messages API `output_config.format` (json_schema)
feature, passed via `extra_body` so it works regardless of the installed SDK
version's typed surface.
"""

from __future__ import annotations

import json
import logging

logger = logging.getLogger("cogniva.llm")


class LLMError(Exception):
    """A recoverable failure from the LLM layer (callers fall back)."""


class LLMClient:
    """Wraps a synchronous Anthropic client and returns parsed JSON objects."""

    def __init__(self, *, model: str, max_tokens: int, timeout: float) -> None:
        import anthropic  # lazy import: skeleton runs even if SDK is absent

        self._anthropic = anthropic
        self._client = anthropic.Anthropic(timeout=timeout)
        self.model = model
        self.max_tokens = max_tokens

    def structured(self, *, system: str, user: str, schema: dict) -> dict:
        """Call the model and return a JSON object conforming to `schema`.

        Raises LLMError on any failure (network, refusal, bad JSON) so the
        caller can fall back gracefully.
        """
        try:
            response = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                extra_body={
                    "output_config": {
                        "format": {"type": "json_schema", "schema": schema}
                    }
                },
            )
        except Exception as exc:  # noqa: BLE001 - normalize to LLMError
            raise LLMError(f"LLM request failed: {exc}") from exc

        if getattr(response, "stop_reason", None) == "refusal":
            raise LLMError("model refused the request")

        text = next(
            (
                block.text
                for block in response.content
                if getattr(block, "type", None) == "text"
            ),
            None,
        )
        if not text:
            raise LLMError("model returned no text content")

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise LLMError(f"model returned invalid JSON: {exc}") from exc
