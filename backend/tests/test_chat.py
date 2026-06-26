import os
from unittest.mock import MagicMock, patch

os.environ["MOCK_MODE"] = "true"  # must be set before main is imported

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(main.app)


def _messages(n: int) -> list[dict]:
    return [{"role": "user", "content": f"msg {i}"} for i in range(n)]


class TestMockMode:
    def test_returns_200(self):
        res = client.post("/chat", json={"messages": _messages(1)})
        assert res.status_code == 200

    def test_response_contains_mock_prefix(self):
        res = client.post("/chat", json={"messages": _messages(1)})
        assert res.json()["message"].startswith("[Mock]")

    def test_echoes_last_message_content(self):
        res = client.post("/chat", json={"messages": [{"role": "user", "content": "hello world"}]})
        assert "hello world" in res.json()["message"]

    def test_empty_messages_list(self):
        res = client.post("/chat", json={"messages": []})
        assert res.status_code == 200


class TestRollingWindow:
    def test_trims_to_window_size(self):
        mock_anthropic = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="reply")]
        mock_anthropic.messages.create.return_value = mock_response

        with patch.object(main, "MOCK_MODE", False), patch.object(main, "client", mock_anthropic):
            res = client.post("/chat", json={"messages": _messages(15)})

        assert res.status_code == 200
        called_with = mock_anthropic.messages.create.call_args[1]["messages"]
        assert len(called_with) == main.ROLLING_WINDOW

    def test_keeps_most_recent_messages(self):
        mock_anthropic = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="reply")]
        mock_anthropic.messages.create.return_value = mock_response

        with patch.object(main, "MOCK_MODE", False), patch.object(main, "client", mock_anthropic):
            client.post("/chat", json={"messages": _messages(15)})

        called_with = mock_anthropic.messages.create.call_args[1]["messages"]
        assert called_with[0]["content"] == "msg 5"
        assert called_with[-1]["content"] == "msg 14"

    def test_passes_through_when_under_window(self):
        mock_anthropic = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="reply")]
        mock_anthropic.messages.create.return_value = mock_response

        with patch.object(main, "MOCK_MODE", False), patch.object(main, "client", mock_anthropic):
            client.post("/chat", json={"messages": _messages(3)})

        called_with = mock_anthropic.messages.create.call_args[1]["messages"]
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
