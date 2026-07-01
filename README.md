# Chat Platform

[![CI](https://github.com/nilpointr/chat-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/nilpointr/chat-platform/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.10+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Node](https://img.shields.io/badge/node-20-339933?logo=node.js&logoColor=white)

A learning-focused AI chatbot MVP — built to understand how LLMs integrate
into a full-stack web application by iterating from working wiring.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (React, TypeScript, Tailwind CSS) |
| Backend | FastAPI (Python 3.10+) |
| LLM | Anthropic Claude (via Python SDK) |
| Python packages | [uv](https://docs.astral.sh/uv/) |

## Prerequisites

- **Node.js** v18+
- **Python** 3.10+
- **uv** — [install guide](https://docs.astral.sh/uv/getting-started/installation/)
- An **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)

## Getting Started

```bash
git clone https://github.com/nilpointr/chat-platform.git
cd chat-platform
```

**Configure the backend:**

```bash
cp backend/.env.example backend/.env
# open backend/.env and set ANTHROPIC_API_KEY=sk-ant-...
```

**Install dependencies:**

```bash
cd backend && uv sync
cd ../frontend && npm install
```

## Running

Open two terminals.

**Terminal 1 — Backend**

```bash
cd backend
uv run uvicorn main:app --reload
# API available at http://localhost:8000
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
# App available at http://localhost:3000
```

**Mock mode** — set `MOCK_MODE=true` in `backend/.env` to stream canned
responses without hitting the Anthropic API. Useful when working on the
frontend or running integration tests without consuming credits.

## Architecture

The stack is intentionally minimal — direct SDK calls before introducing
abstractions like LangChain, and conversation history in React state with
no database.

**Context management** — History lives in React state on the client. Before
each request, the backend trims the oldest user+assistant pairs until the
estimated token count (characters ÷ 4) falls within a 4,096-token budget
(`TOKEN_BUDGET` in `backend/main.py`). This bounds cost in token terms
rather than message count, and always preserves the most recent exchange.

**Streaming** — `POST /chat` returns a `text/event-stream` response. The
backend uses `AsyncAnthropic` + `client.messages.stream()` to forward
tokens as they arrive. The frontend reads the stream via `ReadableStream` /
`getReader()`, growing the assistant bubble token by token. A metadata bar
below each message shows model, token counts, stop reason,
time-to-first-token, and total elapsed time.

**System prompt** — an optional `system_prompt` field on each request
lets the client configure the assistant's persona. It is kept out of the
`messages` array and passed to the Anthropic SDK's `system` parameter
separately. Kept in client-side component state only for now (no
persistence across refreshes).

## API Reference

### `POST /chat`

Streams the assistant's response as Server-Sent Events.

**Request body**

```json
{
  "system_prompt": "You are a pirate captain. Respond only in pirate speak.",
  "messages": [
    { "role": "user", "content": "Hello!" },
    { "role": "assistant", "content": "Hi there! How can I help?" },
    { "role": "user", "content": "What is FastAPI?" }
  ]
}
```

**Response** — `text/event-stream`

```
data: {"type": "delta", "text": "FastAPI "}

data: {"type": "delta", "text": "is a modern "}

data: {"type": "metadata", "model": "claude-haiku-4-5-20251001", "input_tokens": 24, "output_tokens": 118, "stop_reason": "end_turn"}

data: [DONE]
```

| Event | When | Fields |
|-------|------|--------|
| `delta` | Each text chunk | `text` |
| `metadata` | After stream ends | `model`, `input_tokens`, `output_tokens`, `stop_reason` |
| `error` | On API failure | `message` |

## Roadmap

- [x] Streaming responses
- [x] System prompt / persona configuration
- [x] Token budget trimming (alternative to fixed rolling window)
- [ ] LangChain / LangGraph integration (agents, RAG)
- [ ] Deployment
