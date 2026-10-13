import json
from collections.abc import Iterator
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAIError
from pydantic import BaseModel
from starlette.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from database import Base, engine, get_db
from llm_service import LLMService
from models import Chat, Message
from settings import get_settings

app = FastAPI(title="LLM Follow-up")
Base.metadata.create_all(bind=engine)
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
    chat_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str


class MessageResponse(BaseModel):
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse]

    model_config = {"from_attributes": True}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


def get_or_create_chat(db: Session, chat_id: str) -> Chat:
    chat = db.get(Chat, chat_id)
    if chat is None:
        chat = Chat(id=chat_id)
        db.add(chat)
        db.commit()
        db.refresh(chat)
    return chat


def build_llm_messages(chat: Chat) -> list[dict[str, str]]:
    return [
        {"role": message.role, "content": message.content}
        for message in chat.messages
    ]


@app.get("/chats", response_model=list[ChatHistoryResponse])
def get_chats(db: Session = Depends(get_db)) -> list[Chat]:
    statement = (
        select(Chat)
        .options(selectinload(Chat.messages))
        .order_by(Chat.updated_at.desc())
    )
    return list(db.scalars(statement).all())


@app.delete("/chats/{chat_id}", status_code=204)
def delete_chat(chat_id: str, db: Session = Depends(get_db)) -> None:
    chat = db.get(Chat, chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")

    db.delete(chat)
    db.commit()


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    try:
        chat_session = get_or_create_chat(db, request.chat_id)
        if not chat_session.messages:
            chat_session.title = request.message[:255]
        chat_session.updated_at = datetime.utcnow()
        db.add(Message(chat_id=chat_session.id, role="user", content=request.message))
        db.commit()
        db.refresh(chat_session)
        reply = LLMService(get_settings()).generate_reply(build_llm_messages(chat_session))
        db.add(Message(chat_id=chat_session.id, role="assistant", content=reply))
        db.commit()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except (OpenAIError, RuntimeError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return ChatResponse(reply=reply)


def stream_chat_response(
    chat_id: str, message: str, db: Session
) -> Iterator[str]:
    try:
        chat_session = get_or_create_chat(db, chat_id)
        if not chat_session.messages:
            chat_session.title = message[:255]
        chat_session.updated_at = datetime.utcnow()
        db.add(Message(chat_id=chat_session.id, role="user", content=message))
        db.commit()
        db.refresh(chat_session)

        response_parts: list[str] = []
        service = LLMService(get_settings())
        for content in service.generate_reply_stream(build_llm_messages(chat_session)):
            response_parts.append(content)
            yield f"data: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"
        db.add(
            Message(
                chat_id=chat_session.id,
                role="assistant",
                content="".join(response_parts),
            )
        )
        db.commit()
        yield "data: [DONE]\n\n"
    except (OpenAIError, RuntimeError, ValueError) as error:
        error_data = json.dumps({"error": str(error)}, ensure_ascii=False)
        yield f"data: {error_data}\n\n"


@app.post("/chat/stream")
def stream_chat(
    request: ChatRequest, db: Session = Depends(get_db)
) -> StreamingResponse:
    return StreamingResponse(
        stream_chat_response(request.chat_id, request.message, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
