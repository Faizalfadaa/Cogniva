"""LLMClient parsing tests (Architecture Document §3.3, §7.3).

The real Gemini call needs a key and is exercised in integration; here we
stub the inner SDK client to lock the request shape and response parsing —
including structured-output JSON, safety blocks, and malformed output.
"""

import pytest

from app.llm import LLMClient, LLMError


class _Feedback:
    def __init__(self, block_reason=None) -> None:
        self.block_reason = block_reason


class _Response:
    def __init__(self, text, block_reason=None) -> None:
        self._text = text
        self.prompt_feedback = _Feedback(block_reason)

    @property
    def text(self):
        if self._text is None:
            raise ValueError("no text part in response")
        return self._text


class _Models:
    def __init__(self, response: _Response, capture: dict) -> None:
        self._response = response
        self._capture = capture

    def generate_content(self, **kwargs):  # noqa: ANN003
        self._capture.update(kwargs)
        return self._response


class _Inner:
    def __init__(self, response: _Response, capture: dict) -> None:
        self.models = _Models(response, capture)


def _client(monkeypatch) -> LLMClient:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-used")
    return LLMClient(model="gemini-2.5-flash", max_tokens=128, timeout=5)


def test_structured_parses_json_and_sends_schema(monkeypatch):
    client = _client(monkeypatch)
    capture: dict = {}
    client._client = _Inner(_Response('{"answer": 42}'), capture)

    out = client.structured(system="sys", user="usr", schema={"type": "object"})

    assert out == {"answer": 42}
    assert capture["model"] == "gemini-2.5-flash"
    assert capture["contents"] == "usr"
    config = capture["config"]
    assert config["system_instruction"] == "sys"
    assert config["max_output_tokens"] == 128
    assert config["response_mime_type"] == "application/json"
    assert config["response_json_schema"] == {"type": "object"}


def test_structured_raises_on_safety_block(monkeypatch):
    client = _client(monkeypatch)
    client._client = _Inner(_Response(None, block_reason="SAFETY"), {})
    with pytest.raises(LLMError):
        client.structured(system="s", user="u", schema={})


def test_structured_raises_on_bad_json(monkeypatch):
    client = _client(monkeypatch)
    client._client = _Inner(_Response("not json at all"), {})
    with pytest.raises(LLMError):
        client.structured(system="s", user="u", schema={})
