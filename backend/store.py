from typing import Dict, List
from datetime import datetime
import uuid

class InMemoryStore:
    def __init__(self):
        self.sessions: Dict[str, dict] = {}  # id -> {id,name,created_at}
        self.messages: Dict[str, List[dict]] = {}  # session_id -> [messages]

    def create_session(self, name: str):
        sid = str(uuid.uuid4())
        s = {"id": sid, "name": name or "新对话", "created_at": datetime.utcnow().isoformat()}
        self.sessions[sid] = s
        self.messages[sid] = []
        return s

    def list_sessions(self):
        # 最新在前
        return sorted(self.sessions.values(), key=lambda x: x["created_at"], reverse=True)

    def add_message(self, session_id: str, role: str, content: str):
        mid = str(uuid.uuid4())
        msg = {
            "id": mid,
            "session_id": session_id,
            "role": role,
            "content": content,
            "created_at": datetime.utcnow().isoformat()
        }
        self.messages[session_id].append(msg)
        return msg

    def get_messages(self, session_id: str):
        return self.messages.get(session_id, [])
