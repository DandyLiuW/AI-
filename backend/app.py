import os
import json
import asyncio
import random
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv

# 兼容你已有的 CreateSessionReq；chat 接口我们手动取 JSON，避免你先改 models.py
from models import CreateSessionReq
from store import InMemoryStore

# ========= 环境变量 =========
load_dotenv()
CORS = os.getenv("CORS_ORIGINS", "*").split(",")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ========= OpenAI 兼容客户端（可用 OpenRouter/DeepSeek/OpenAI 等）=========
client = None
try:
    from openai import AsyncOpenAI
    if OPENAI_API_KEY and OPENAI_BASE_URL:
        client = AsyncOpenAI(base_url=OPENAI_BASE_URL, api_key=OPENAI_API_KEY)
except Exception as e:
    print(f"[WARN] OpenAI-compatible client init failed: {e}")

# ========= FastAPI & Store =========
app = FastAPI(title="ChatGPT-like API (Tarot Edition)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
STORE = InMemoryStore()

# ========= 工具函数 =========
def sse(data: str) -> str:
    return f"data: {data}\n\n"

# ---- 牌库加载（无文件时用兜底简版）----
def load_tarot_deck() -> List[Dict[str, Any]]:
    path = os.path.join(os.path.dirname(__file__), "tarot_deck.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    # 兜底（先给几张大阿尔卡那，建议你尽快补满 78 张到 tarot_deck.json）
    return [
        {"name":"The Fool","cn":"愚者","id":"0","upright":["新的开始","冒险","自由"],"reversed":["冲动","鲁莽","迷茫"]},
        {"name":"The Magician","cn":"魔术师","id":"1","upright":["意志","资源整合","沟通"],"reversed":["欺骗","方向不明","资源受限"]},
        {"name":"The High Priestess","cn":"女祭司","id":"2","upright":["直觉","潜意识","沉静"],"reversed":["压抑直觉","秘密外泄","迟疑"]},
        {"name":"The Empress","cn":"皇后","id":"3","upright":["丰饶","关怀","创造"],"reversed":["懒散","过度依赖","窒息的爱"]},
        {"name":"The Emperor","cn":"皇帝","id":"4","upright":["秩序","权威","结构"],"reversed":["控制欲","僵化","权力失衡"]}
    ]

TAROT_DECK: List[Dict[str, Any]] = load_tarot_deck()
SPREAD_SLOTS: Dict[str, List[str]] = {
    "three": ["过去", "现在", "未来"],
    "celtic": ["现状","挑战","潜意识","显意识","过去","未来","自我","环境","希望与恐惧","结果"],
}

def draw_cards(spread: str, seed: Optional[str] = None) -> List[Dict[str, Any]]:
    if spread not in SPREAD_SLOTS:
        raise ValueError("未知牌阵")
    rnd = random.Random(seed or os.urandom(8))
    deck = TAROT_DECK.copy()
    rnd.shuffle(deck)
    n = len(SPREAD_SLOTS[spread])
    picks = deck[:n]
    result = []
    for i, card in enumerate(picks):
        upright = rnd.random() > 0.5
        result.append({
            "slot": SPREAD_SLOTS[spread][i],
            "id": card["id"],
            "name": card["name"],
            "cn": card["cn"],
            "upright": upright,
            "meanings": card["upright"] if upright else card["reversed"]
        })
    return result

def tarot_system_prompt() -> str:
    return (
        "你是一位专业塔罗师，语气温和、尊重自由意志。请基于提供的牌阵与牌义进行解读："
        "先给【总体氛围】，再按牌位逐一解释，最后给【建议】。避免绝对化结论；"
        "不要涉及医疗/法律/投资等专业建议；必要处加入免责声明。输出格式：\n"
        "## 总体\n（1-3句）\n"
        "## 逐位解读\n- 牌位：牌名（正/逆） → 2-3句\n"
        "## 建议\n（1-3条，务实且可操作）"
    )

def build_messages(mode: str, user_message: str, meta: Dict[str, Any]) -> List[Dict[str, str]]:
    if mode == "tarot":
        topic = meta.get("topic", "")
        spread = meta.get("spread", "three")
        cards = meta.get("cards", [])
        tool_content = {"topic": topic, "spread": spread, "cards": cards}
        return [
            {"role": "system", "content": tarot_system_prompt()},
            {"role": "user", "content": f"主题：{topic}。请根据下方抽到的牌进行解读。"},
            {"role": "system", "content": f"[抽到的牌JSON]\n{json.dumps(tool_content, ensure_ascii=False)}"}
        ]
    # 默认普通聊天
    return [
        {"role": "system", "content": "You are a helpful assistant. Reply in the user's language."},
        {"role": "user", "content": user_message}
    ]

async def model_stream(messages: List[Dict[str, str]]):
    """OpenAI 兼容流式；若 client 为 None 将抛异常，外层兜底"""
    stream = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=messages,
        temperature=0.7,
        stream=True,
    )
    async for event in stream:
        if not getattr(event, "choices", None):
            continue
        delta = event.choices[0].delta
        if getattr(delta, "content", None):
            yield delta.content

async def demo_stream():
    demo = [
        "（演示流）你已经连通前后端啦！\n",
        "要接入真模型：在 backend/.env 设置 OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL，然后重启后端。\n"
    ]
    for c in demo:
        await asyncio.sleep(0.25)
        yield c

# ========= 基础路由 =========
@app.get("/api/health")
def health():
    return {"ok": True, "time": datetime.utcnow().isoformat()}

@app.post("/api/sessions")
def create_session(req: CreateSessionReq):
    s = STORE.create_session(req.name or "新对话")
    return s

@app.get("/api/sessions")
def list_sessions():
    return STORE.list_sessions()

@app.get("/api/messages")
def get_messages(session_id: str):
    return STORE.get_messages(session_id)

# ========= 塔罗抽牌 =========
@app.post("/api/tarot/draw")
async def tarot_draw(spread: str = "three", seed: Optional[str] = None):
    try:
        return {"spread": spread, "cards": draw_cards(spread, seed)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)

# ========= 核心：聊天（支持 mode=chat / tarot）=========
@app.post("/api/chat/stream")
async def chat_stream(request: Request):
    """
    请求体 JSON：
    {
      "session_id": "...",
      "user_message": "...",
      "mode": "chat" | "tarot",           # 可选，默认 chat
      "meta": { "topic": "...", "spread": "three", "cards": [...] }  # 塔罗模式下可选
    }
    """
    data = await request.json()
    session_id: str = data.get("session_id")
    user_message: str = data.get("user_message", "")
    mode: str = data.get("mode", "chat")
    meta: Dict[str, Any] = data.get("meta", {}) or {}

    if not session_id:
        return JSONResponse({"error": "session_id is required"}, status_code=400)

    # 记录用户消息
    STORE.add_message(session_id, "user", user_message or (meta.get("topic") or ""))

    async def generator():
        yield sse('{"type":"start"}')
        full: List[str] = []

        try:
            msgs = build_messages(mode, user_message, meta)
            if client:
                async for chunk in model_stream(msgs):
                    full.append(chunk)
                    yield sse(chunk)
            else:
                async for chunk in demo_stream():
                    full.append(chunk)
                    yield sse(chunk)
        except Exception as e:
            err = f"[模型调用出错] {type(e).__name__}: {e}"
            full.append("\n" + err)
            yield sse(err)

        yield sse('{"type":"end"}')
        STORE.add_message(session_id, "assistant", "".join(full))
        yield "event: close\n" + sse("done")

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
    }
    return StreamingResponse(generator(), headers=headers)
