import json
import os

from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

client = AsyncAnthropic() if not MOCK_MODE else None

ROLLING_WINDOW = 10  # max messages sent to the model per request


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


@app.post("/chat")
async def chat(request: ChatRequest):
    windowed = request.messages[-ROLLING_WINDOW:]

    async def generate():
        if MOCK_MODE:
            last = windowed[-1].content if windowed else ""
            words = f"[Mock] Received: {last!r}".split()
            for word in words:
                yield f"data: {json.dumps({'type': 'delta', 'text': word + ' '})}\n\n"
            yield f"data: {json.dumps({'type': 'metadata', 'model': 'mock', 'input_tokens': 0, 'output_tokens': len(words), 'stop_reason': 'end_turn'})}\n\n"
        else:
            try:
                async with client.messages.stream(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=1024,
                    messages=[m.model_dump() for m in windowed],
                ) as stream:
                    async for text in stream.text_stream:
                        yield f"data: {json.dumps({'type': 'delta', 'text': text})}\n\n"
                    final = await stream.get_final_message()
                    yield f"data: {json.dumps({'type': 'metadata', 'model': final.model, 'input_tokens': final.usage.input_tokens, 'output_tokens': final.usage.output_tokens, 'stop_reason': final.stop_reason})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
