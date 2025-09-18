from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime

class Message(BaseModel):
    id: str
    session_id: str
    role: str  # "user" | "assistant" | "system"
    content: str
    created_at: datetime

class CreateSessionReq(BaseModel):
    name: Optional[str] = None

class Session(BaseModel):
    id: str
    name: str
    created_at: datetime

class ChatReq(BaseModel):
    session_id: str
    user_message: str

class ChatReq(BaseModel):
    session_id: str
    user_message: str
    mode: Optional[Literal["chat", "tarot"]] = "chat"
    meta: Optional[Dict[str, Any]] = None  # 这里放牌阵、抽到的牌、主题等