from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from llm_service import LLMService
from settings import get_settings

app = FastAPI(title="LLM Follow-up")


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

    return ChatResponse(reply=reply)
