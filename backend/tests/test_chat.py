import json as json_lib
import os
from unittest.mock import AsyncMock, MagicMock, patch

os.environ["MOCK_MODE"] = "true"  # must be set before main is imported

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(main.app)


def _messages(n: int) -> list[dict]:
    return [{"role": "user", "content": f"msg {i}"} for i in range(n)]


def _collect_sse_text(res) -> str:
    """Concatenate all delta event text from an SSE response."""
    text = ""
    for line in res.text.split("\n"):
        if line.startswith("data: "):
            data = line[6:]
            if data == "[DONE]":
                break
            event = json_lib.loads(data)
            if event.get("type") == "delta":
                text += event["text"]
    return text


def _make_mock_client(texts=("reply",)):
    """Build an AsyncAnthropic-shaped mock for streaming tests."""
    mock_client = MagicMock()

    mock_stream = MagicMock()
    mock_stream.__aenter__ = AsyncMock(return_value=mock_stream)
    mock_stream.__aexit__ = AsyncMock(return_value=None)

    async def _text_iter():
        for t in texts:
            yield t

    mock_stream.text_stream = _text_iter()

    mock_final = MagicMock()
    mock_final.model = "claude-haiku-4-5-20251001"
    mock_final.usage.input_tokens = 10
    mock_final.usage.output_tokens = 5
    mock_final.stop_reason = "end_turn"
    mock_stream.get_final_message = AsyncMock(return_value=mock_final)

    mock_client.messages.stream.return_value = mock_stream
    return mock_client


class TestMockMode:
    def test_returns_200(self):
        res = client.post("/chat", json={"messages": _messages(1)})
        assert res.status_code == 200

    def test_response_contains_mock_prefix(self):
        res = client.post("/chat", json={"messages": _messages(1)})
        assert _collect_sse_text(res).startswith("[Mock]")

    def test_echoes_last_message_content(self):
        res = client.post("/chat", json={"messages": [{"role": "user", "content": "hello world"}]})
        assert "hello world" in _collect_sse_text(res)

    def test_empty_messages_list(self):
        res = client.post("/chat", json={"messages": []})
        assert res.status_code == 200


class TestRollingWindow:
    def test_trims_to_window_size(self):
        mock_client = _make_mock_client()
        with patch.object(main, "MOCK_MODE", False), patch.object(main, "client", mock_client):
            res = client.post("/chat", json={"messages": _messages(15)})

        assert res.status_code == 200
        called_with = mock_client.messages.stream.call_args.kwargs["messages"]
        assert len(called_with) == main.ROLLING_WINDOW

    def test_keeps_most_recent_messages(self):
        mock_client = _make_mock_client()
        with patch.object(main, "MOCK_MODE", False), patch.object(main, "client", mock_client):
            client.post("/chat", json={"messages": _messages(15)})

        called_with = mock_client.messages.stream.call_args.kwargs["messages"]
        assert called_with[0]["content"] == "msg 5"
        assert called_with[-1]["content"] == "msg 14"

    def test_passes_through_when_under_window(self):
        mock_client = _make_mock_client()
        with patch.object(main, "MOCK_MODE", False), patch.object(main, "client", mock_client):
            client.post("/chat", json={"messages": _messages(3)})

        called_with = mock_client.messages.stream.call_args.kwargs["messages"]
        assert len(called_with) == 3


class TestRequestValidation:
    def test_missing_messages_field_returns_422(self):
        res = client.post("/chat", json={})
        assert res.status_code == 422

    def test_malformed_message_object_returns_422(self):
        res = client.post("/chat", json={"messages": [{"invalid": "shape"}]})
        assert res.status_code == 422

    def test_wrong_role_type_returns_422(self):
        res = client.post("/chat", json={"messages": [{"role": 123, "content": "hi"}]})
        assert res.status_code == 422
