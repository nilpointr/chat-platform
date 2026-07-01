# Chat Platform — Frontend

Next.js (App Router) client for the chat platform. See the [root README](../README.md)
for the overall architecture, request flow, and backend API reference.

## Structure

| File | Responsibility |
|------|-----------------|
| `app/page.tsx` | Top-level layout: header, message list, input, system prompt panel |
| `app/useChatStream.ts` | `useReducer`-based state machine for messages; drives the SSE request via `chatApi` |
| `app/chatApi.ts` | Fetches `POST /chat` and parses the `text/event-stream` body |
| `app/MessageBubble.tsx` | Renders a single message, including the metadata footer |
| `app/ChatInput.tsx` | Text input + submit button |
| `app/SystemPromptPanel.tsx` | Collapsible panel for editing the persona/system prompt |

## Configuration

`NEXT_PUBLIC_BACKEND_URL` (see `.env.local`) — base URL of the FastAPI backend.
Defaults to `http://localhost:8000` if unset.

## Getting Started

```bash
npm install
npm run dev
```

Requires the backend running separately — see the [root README](../README.md#running).

Open [http://localhost:3000](http://localhost:3000) to view the app.
