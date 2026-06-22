"""LLMClient parsing tests (Architecture Document §3.3, §7.3).

The real Anthropic call needs a key and is exercised in integration; here we
stub the inner SDK client to lock the request shape and response parsing —
including structured-output JSON, refusals, and malformed output.
"""

import pytest

from app.llm import LLMClient, LLMError


class _Block:
    def __init__(self, text: str) -> None:
        self.type = "text"
        self.text = text


class _Response:
    def __init__(self, content: list, stop_reason: str = "end_turn") -> None:
        self.content = content
        self.stop_reason = stop_reason


class _Messages:
    def __init__(self, response: _Response, capture: dict) -> None:
        self._response = response
        self._capture = capture

    def create(self, **kwargs):  # noqa: ANN003
        self._capture.update(kwargs)
        return self._response


class _Inner:
    def __init__(self, response: _Response, capture: dict) -> None:
        self.messages = _Messages(response, capture)


def _client(monkeypatch) -> LLMClient:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-used")
    return LLMClient(model="claude-opus-4-8", max_tokens=128, timeout=5)


def test_structured_parses_json_and_sends_schema(monkeypatch):
    client = _client(monkeypatch)
    capture: dict = {}
    client._client = _Inner(_Response([_Block('{"answer": 42}')]), capture)

    out = client.structured(system="sys", user="usr", schema={"type": "object"})

    assert out == {"answer": 42}
    assert capture["model"] == "claude-opus-4-8"
    assert capture["max_tokens"] == 128
    fmt = capture["extra_body"]["output_config"]["format"]
    assert fmt["type"] == "json_schema"
    assert fmt["schema"] == {"type": "object"}


def test_structured_raises_on_refusal(monkeypatch):
    client = _client(monkeypatch)
    client._client = _Inner(_Response([], stop_reason="refusal"), {})
    with pytest.raises(LLMError):
        client.structured(system="s", user="u", schema={})


def test_structured_raises_on_bad_json(monkeypatch):
    client = _client(monkeypatch)
    client._client = _Inner(_Response([_Block("not json at all")]), {})
    with pytest.raises(LLMError):
        client.structured(system="s", user="u", schema={})
