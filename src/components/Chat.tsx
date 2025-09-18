import React, { useEffect, useMemo, useState } from 'react'
import MessageList from './MessageList'
import Composer from './Composer'
import TarotBoard from './TarotBoard'
import { createSession, getMessages, listSessions, openChatStream, drawTarot } from '../api'
import { Message, Session, TarotCard } from '../types'

type Mode = 'chat' | 'tarot'

export default function Chat() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [current, setCurrent] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [assistantBuffer, setAssistantBuffer] = useState<string>('')

  // ====== tarot extra ======
  const [mode, setMode] = useState<Mode>('tarot')     // 默认直接进入“塔罗模式”
  const [spread, setSpread] = useState<'three'|'celtic'>('three')
  const [topic, setTopic] = useState<string>('')
  const [cards, setCards] = useState<TarotCard[]>([])
  const [drawing, setDrawing] = useState(false)

  useEffect(() => { listSessions().then(setSessions) }, [])

  useEffect(() => {
    if (current) { getMessages(current.id).then(setMessages); setAssistantBuffer('') }
  }, [current])

  const viewMessages = useMemo(() => {
    if (!assistantBuffer) return messages
    return [...messages, { role: 'assistant', content: assistantBuffer }] as any
  }, [messages, assistantBuffer])

  const newChat = async () => {
    const s = await createSession('新对话')
    setSessions(prev=>[s, ...prev])
    setCurrent(s)
  }

  const ensureSession = async (): Promise<string> => {
    if (current) return current.id
    const s = await createSession('新对话')
    const latest = await listSessions()
    setSessions(latest)
    setCurrent(latest[0])
    return s.id
  }

  // ====== 普通聊天发送 ======
  const send = async (userText: string) => {
    const sid = await ensureSession()
    setMessages(prev => [...prev, {
      id: String(Date.now()),
      session_id: sid,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString()
    } as any])

    setAssistantBuffer('')
    setStreaming(true)

    openChatStream({ session_id: sid, user_message: userText }, chunk => {
      setAssistantBuffer(prev => prev + chunk)
    }, () => {
      setStreaming(false)
      getMessages(sid).then(setMessages)
      setAssistantBuffer('')
    })
  }

  // ====== 抽牌 ======
  const onDraw = async () => {
    setDrawing(true)
    try {
      const resp = await drawTarot(spread)
      if (resp?.cards) setCards(resp.cards)
    } finally {
      setDrawing(false)
    }
  }

  // ====== 开始解读（塔罗模式）=====
  const interpret = async () => {
    if (!topic.trim()) {
      alert('请先输入主题/问题，例如：感情复合是否合适？')
      return
    }
    if (!cards.length) {
      alert('请先抽牌')
      return
    }
    const sid = await ensureSession()

    // 在消息流里也记录用户“问题”
    setMessages(prev => [...prev, {
      id: String(Date.now()),
      session_id: sid,
      role: 'user',
      content: `【塔罗解读】主题：${topic}；牌阵：${spread}；共 ${cards.length} 张牌`,
      created_at: new Date().toISOString()
    } as any])

    setAssistantBuffer('')
    setStreaming(true)

    openChatStream({
      session_id: sid,
      user_message: topic,
      mode: 'tarot',
      meta: { topic, spread, cards }
    }, chunk => {
      setAssistantBuffer(prev => prev + chunk)
    }, () => {
      setStreaming(false)
      getMessages(sid).then(setMessages)
      setAssistantBuffer('')
    })
  }

  return (
    <div style={{ height: '100vh', display:'grid', gridTemplateColumns:'260px 1fr' }}>
      {/* 左侧：会话列表 */}
      <aside style={{ borderRight:'1px solid #eee', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:12, borderBottom:'1px solid #eee', fontWeight:600 }}>会话</div>
        <button onClick={newChat} style={{ margin:12, padding:'8px 12px', borderRadius:8 }}>＋ 新建对话</button>
        <div style={{ overflow:'auto' }}>
          {sessions.map(s => (
            <div key={s.id}
                 onClick={()=>setCurrent(s)}
                 style={{
                   padding:'10px 12px',
                   cursor:'pointer',
                   background: current?.id===s.id ? '#f5faff' : 'transparent'
                 }}>
              {s.name}
              <div style={{ fontSize:12, opacity:0.6 }}>{new Date(s.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* 右侧：主区域 */}
      <main style={{ display:'flex', flexDirection:'column' }}>
        {/* 顶栏 */}
        <div style={{ padding:12, borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:600 }}>{current?.name ?? '未选择会话'}</div>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <label style={{ fontSize:13 }}>
              <input type="radio" name="mode" value="chat" checked={mode==='chat'} onChange={()=>setMode('chat')} /> 普通聊天
            </label>
            <label style={{ fontSize:13 }}>
              <input type="radio" name="mode" value="tarot" checked={mode==='tarot'} onChange={()=>setMode('tarot')} /> 塔罗占卜
            </label>
            <div style={{ fontSize:12, opacity:0.6 }}>{streaming ? '生成中…' : '就绪'}</div>
          </div>
        </div>

        {/* 主内容 */}
        <div style={{ flex:1, overflow:'auto' }}>
          {/* 塔罗控制区 */}
          {mode === 'tarot' && (
            <div style={{ padding:12, borderBottom:'1px solid #f2f2f2', background:'#fafafa' }}>
              <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                <div>
                  <label style={{ fontSize:12, opacity:0.8 }}>牌阵：</label>
                  <select value={spread} onChange={e=>setSpread(e.target.value as any)} style={{ padding:'6px 8px', borderRadius:8 }}>
                    <option value="three">三张牌（过去/现在/未来）</option>
                    <option value="celtic">凯尔特十字（10张）</option>
                  </select>
                </div>
                <input
                  value={topic}
                  onChange={e=>setTopic(e.target.value)}
                  placeholder="主题/问题（例如：感情复合是否合适？）"
                  style={{ flex:1, minWidth:260, padding:'6px 10px', borderRadius:8, border:'1px solid #ddd' }}
                />
                <button onClick={onDraw} disabled={drawing} style={{ padding:'6px 12px', borderRadius:8 }}>
                  {drawing ? '抽牌中…' : '抽牌'}
                </button>
                <button onClick={interpret} disabled={streaming || !cards.length || !topic.trim()} style={{ padding:'6px 12px', borderRadius:8 }}>
                  开始解读
                </button>
              </div>
              {!!cards.length && <TarotBoard cards={cards} />}
            </div>
          )}

          {/* 聊天区 */}
          <MessageList messages={viewMessages} />
        </div>

        {/* 输入区：普通聊天用，塔罗模式下隐藏（因为有专门按钮） */}
        {mode === 'chat' && <Composer onSend={send} disabled={streaming} />}
      </main>
    </div>
  )
}
