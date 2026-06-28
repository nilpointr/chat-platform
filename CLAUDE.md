# Chat Platform

AI-enabled chatbot MVP. Goal: learn concepts, iterate from working wiring.

## Stack
- **Frontend:** Next.js (React, TypeScript)
- **Backend:** FastAPI (Python) + `anthropic` SDK (direct, no LangChain yet)
- **History:** React state only — no DB, no persistence between sessions

## Context management
Rolling window of last 10 messages per request (`ROLLING_WINDOW = 10`).
Optional `system_prompt` field sent per request; stored in `localStorage` on the client.

## Streaming
`POST /chat` returns SSE (`text/event-stream`). Backend uses `AsyncAnthropic` +
`client.messages.stream()`. Events: `delta` (text chunk), `metadata` (token counts,
stop_reason, model), `error`, `[DONE]`. Frontend uses `ReadableStream` / `getReader()`.
Metadata bar shown below each assistant message.

## Principles
- Keep context window small → cost discipline
- Direct SDK calls before introducing abstractions (LangChain/LangGraph later)
- See README.md for architecture decisions and roadmap
