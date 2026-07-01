import json
import logging
import os
from typing import Literal

from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

logger = logging.getLogger(__name__)

MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["POST"],
    allow_headers=["*"],
)

client = AsyncAnthropic() if not MOCK_MODE else None

TOKEN_BUDGET = 4096  # estimated input tokens for the messages array


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    system_prompt: str = ""


def _trim_to_budget(messages: list[Message]) -> list[Message]:
    # ~4 chars per token; drop oldest pairs until under budget
    def est(msgs):
        return sum(len(m.content) for m in msgs) // 4

    while est(messages) > TOKEN_BUDGET and len(messages) >= 2:
        messages = messages[2:]
    return messages


@app.post("/chat")
async def chat(request: ChatRequest):
    windowed = _trim_to_budget(request.messages)

    async def generate():
        if MOCK_MODE:
            last = windowed[-1].content if windowed else ""
            prompt_info = f"[system: {request.system_prompt!r}] " if request.system_prompt else ""
            words = f"[Mock] {prompt_info}Received: {last!r}".split()
            for word in words:
                yield f"data: {json.dumps({'type': 'delta', 'text': word + ' '})}\n\n"
            yield f"data: {json.dumps({'type': 'metadata', 'model': 'mock', 'input_tokens': 0, 'output_tokens': len(words), 'stop_reason': 'end_turn'})}\n\n"
        else:
            try:
                stream_kwargs = {
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 1024,
                    "messages": [m.model_dump() for m in windowed],
                }
                if request.system_prompt:
                    stream_kwargs["system"] = request.system_prompt
                async with client.messages.stream(**stream_kwargs) as stream:
                    async for text in stream.text_stream:
                        yield f"data: {json.dumps({'type': 'delta', 'text': text})}\n\n"
                    final = await stream.get_final_message()
                    yield f"data: {json.dumps({'type': 'metadata', 'model': final.model, 'input_tokens': final.usage.input_tokens, 'output_tokens': final.usage.output_tokens, 'stop_reason': final.stop_reason})}\n\n"
            except Exception:
                logger.exception("Error while streaming chat response")
                yield f"data: {json.dumps({'type': 'error', 'message': 'Something went wrong. Please try again.'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
