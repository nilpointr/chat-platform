# Chat Platform — Design Notes

## Goal

A learning-focused MVP of an AI-enabled chatbot. Primary objective is
understanding the concepts (context management, streaming, API integration)
while building a working product that can be iterated on.

## Tech Stack

| Layer    | Choice              | Notes                                      |
|----------|---------------------|--------------------------------------------|
| Frontend | Next.js (React, TS) |                                            |
| Backend  | FastAPI (Python)    | Async, good foundation for AI/ML ecosystem |
| LLM SDK  | `anthropic` (Python)| Direct SDK, no LangChain to start          |
| History  | React state only    | No database; no persistence between sessions |

## Key Design Decisions

### 1. Context management — rolling window (last N messages)

- No persistent memory between sessions
- Conversation history lives in React state on the client
- Each request sends the last N messages to keep context window bounded
- Rationale: keeps costs predictable; teaches the core concept that
  history is just an array you manage manually

### 2. Cost discipline

- Keep the context window from filling up as the primary cost lever
- Rolling window is the first mechanism; token budget trimming is a
  future option if needed
- No LangChain overhead to start — direct SDK calls only

### 3. No persona or domain (yet)

- System prompt intentionally minimal for now
- First goal is to get the wiring right; persona/domain is a later iteration

## Architecture (target)

```
[Next.js frontend]  <-->  [FastAPI backend]  <-->  [Anthropic API]
   React state                /chat endpoint         claude-* model
   (chat history)            rolls history
```

### 4. Streaming responses — SSE over `POST /chat`

- Backend uses `AsyncAnthropic` + `client.messages.stream()` inside a
  FastAPI `StreamingResponse`
- Protocol: Server-Sent Events (SSE) over a standard HTTP POST. Three
  event types:
  - `{"type": "delta", "text": "..."}` — a text chunk from the model
  - `{"type": "metadata", "model": "...", "input_tokens": N, "output_tokens": N, "stop_reason": "..."}` — emitted once after the stream ends
  - `{"type": "error", "message": "..."}` — emitted if the API call fails
  - `data: [DONE]` — sentinel to mark end of stream
- Frontend reads the stream with `ReadableStream` / `getReader()`, buffers
  lines to handle chunk boundaries, and updates React state per token
- Bouncing dots appear while `content === ""` (waiting for first token);
  replaced by growing text once tokens arrive
- Metadata bar appears below each assistant message after streaming
  completes, showing: model, input/output token counts, stop reason,
  time-to-first-token (TTFT), and total elapsed time
- Mock mode streams word-by-word instantly; real mode shows natural
  network latency between tokens

## Open Items / Next Iterations

- System prompt / persona
- Token budget trimming (alternative to fixed rolling window)
- LangChain or LangGraph integration (agents, RAG)
- Deployment
