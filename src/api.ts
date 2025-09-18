const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export async function createSession(name?: string) {
  const res = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ name })
  })
  return res.json()
}

export async function listSessions() {
  const res = await fetch(`${BASE}/api/sessions`)
  return res.json()
}

export async function getMessages(session_id: string) {
  const res = await fetch(`${BASE}/api/messages?session_id=${encodeURIComponent(session_id)}`)
  return res.json()
}

/** 打开流式聊天；payload 可传 { mode, meta } 等 */
export function openChatStream(
  body: any,
  onChunk: (t: string)=>void,
  onEnd?: ()=>void
) {
  const controller = new AbortController()
  fetch(`${BASE}/api/chat/stream`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
    signal: controller.signal
  }).then(res => {
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()

    const read = (): any =>
      reader?.read().then(({ done, value }) => {
        if (done) { onEnd && onEnd(); return }
        const chunk = decoder.decode(value, { stream: true })
        // 解析 SSE：逐行找 data:
        chunk.split('\n').forEach(line => {
          const trimmed = line.trim()
          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim()
            // 过滤掉 {"type":"start"} / {"type":"end"} 这类标记
            if (data && !data.startsWith('{')) onChunk(data)
          }
        })
        return read()
      })

    return read()
  }).catch(() => onEnd && onEnd())

  return () => controller.abort()
}

/** 抽牌接口 */
export async function drawTarot(spread: 'three'|'celtic' = 'three', seed?: string) {
  const url = new URL(`${BASE}/api/tarot/draw`)
  url.searchParams.set('spread', spread)
  if (seed) url.searchParams.set('seed', seed)
  const res = await fetch(url.toString(), { method: 'POST' })
  return res.json()
}
