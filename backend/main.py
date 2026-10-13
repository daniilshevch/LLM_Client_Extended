import json
from collections.abc import Iterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAIError
from pydantic import BaseModel
from starlette.responses import StreamingResponse

from llm_service import LLMService
from settings import get_settings

app = FastAPI(title="LLM Follow-up")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        service = LLMService(get_settings())
        reply = service.generate_reply(request.message)
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except (OpenAIError, RuntimeError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return ChatResponse(reply=reply)


def stream_chat_response(message: str) -> Iterator[str]:
    try:
        service = LLMService(get_settings())
        for content in service.generate_reply_stream(message):
            yield f"data: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    except (OpenAIError, RuntimeError, ValueError) as error:
        error_data = json.dumps({"error": str(error)}, ensure_ascii=False)
        yield f"data: {error_data}\n\n"


@app.post("/chat/stream")
def stream_chat(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_chat_response(request.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
