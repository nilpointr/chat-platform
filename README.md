# Chat Platform

An AI-enabled chatbot MVP built to learn the core concepts of integrating
large language models into a full-stack web application.

## Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | Next.js 15 (React, TypeScript, Tailwind CSS) |
| Backend  | FastAPI (Python 3.10+)            |
| LLM      | Anthropic Claude (via Python SDK) |
| Package manager (Python) | [uv](https://docs.astral.sh/uv/) |

## Prerequisites

- **Node.js** v18+ (project developed on v26)
- **Python** 3.10+
- **uv** — [install guide](https://docs.astral.sh/uv/getting-started/installation/)
- An **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

## Project Structure

```
chat-platform/
├── frontend/          # Next.js app (React, TypeScript, Tailwind)
│   ├── app/           # App router pages and layouts
│   └── package.json
├── backend/           # FastAPI app
│   ├── main.py        # API entrypoint — /chat endpoint
│   ├── pyproject.toml # Python project config + dependencies
│   ├── uv.lock        # Locked dependency versions
│   └── .env.example   # Environment variable template
├── .env.example       # Root-level env template (reference)
├── CLAUDE.md          # AI assistant context file
└── DESIGN_NOTES.md    # Architecture decisions
```

## Getting Started

### 1. Clone the repo

```bash
git clone <repo-url>
cd chat-platform
```

### 2. Configure the backend environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Install backend dependencies

```bash
cd backend
uv sync
```

`uv sync` creates a virtual environment (`.venv`) and installs all
dependencies from `uv.lock` automatically — no manual activation needed
for running commands via `uv run`.

### 4. Install frontend dependencies

```bash
cd frontend
npm install
```

## Running the App

Both services must be running simultaneously. Open two terminal windows.

### Terminal 1 — Backend

```bash
cd backend
uv run uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.  
`--reload` enables hot-reloading on file changes.

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:3000`.

## API Reference

### `POST /chat`

Accepts a conversation history and returns the assistant's next message.

**Request body**

```json
{
  "messages": [
    { "role": "user", "content": "Hello!" },
    { "role": "assistant", "content": "Hi there! How can I help?" },
    { "role": "user", "content": "What is FastAPI?" }
  ]
}
```

**Response**

```json
{
  "message": "FastAPI is a modern Python web framework..."
}
```

**Notes**
- The backend applies a rolling window of the last 10 messages before
  forwarding to the model, keeping context costs bounded.
- The model used is `claude-haiku-4-5` — fast and cost-efficient for
  development.

## Key Concepts

**Rolling window context management** — Rather than sending the full
conversation history on every request, the backend trims the message list
to the last N messages. This keeps the context window bounded and API
costs predictable. The value of N is set via `ROLLING_WINDOW` in
`backend/main.py`.

## Roadmap

- [ ] Streaming responses
- [ ] System prompt / persona configuration
- [ ] Token budget trimming (alternative to fixed rolling window)
- [ ] LangChain / LangGraph integration (agents, RAG)
- [ ] Deployment
