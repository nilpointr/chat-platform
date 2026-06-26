from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

client = Anthropic()  # reads ANTHROPIC_API_KEY from environment

ROLLING_WINDOW = 10  # max messages sent to the model per request


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


@app.post("/chat")
async def chat(request: ChatRequest):
    windowed = request.messages[-ROLLING_WINDOW:]
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[m.model_dump() for m in windowed],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"message": response.content[0].text}
