# Chat Platform

AI-enabled chatbot MVP. Goal: learn concepts, iterate from working wiring.

## Stack
- **Frontend:** Next.js (React, TypeScript)
- **Backend:** FastAPI (Python) + `anthropic` SDK (direct, no LangChain yet)
- **History:** React state only — no DB, no persistence between sessions

## Context management
Rolling window of last N messages per request. N not yet decided.
No system prompt/persona yet.

## Principles
- Keep context window small → cost discipline
- Direct SDK calls before introducing abstractions (LangChain/LangGraph later)
- See DESIGN_NOTES.md for full decisions and open items
