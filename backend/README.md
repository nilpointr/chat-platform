# Chat Platform — Backend

FastAPI service that streams chat completions from Claude. See the
[root README](../README.md) for the overall architecture, request flow, and
API reference.

## Structure

| File | Responsibility |
|------|-----------------|
| `main.py` | FastAPI app, `POST /chat` endpoint, token-budget trimming, mock mode |
| `tests/test_chat.py` | Endpoint tests (mock mode, token budget, system prompt, validation) |

## Configuration

Copy `.env.example` to `.env` and set:

- `ANTHROPIC_API_KEY` — required unless `MOCK_MODE` is enabled
- `MOCK_MODE` — set `true` to stream canned responses instead of calling the
  Anthropic API (used for frontend development and tests)
- `FRONTEND_ORIGIN` — origin allowed via CORS, defaults to `http://localhost:3000`

## Getting Started

```bash
uv sync
uv run uvicorn main:app --reload
```

API available at `http://localhost:8000`.

## Tests

```bash
uv run pytest
```
