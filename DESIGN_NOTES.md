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

## Open Items / Next Iterations

- Decide value of N for the rolling window
- Streaming responses (vs. wait-for-complete)
- System prompt / persona
- LangChain or LangGraph integration (agents, RAG)
- Deployment
