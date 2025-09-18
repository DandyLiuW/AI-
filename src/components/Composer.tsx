import React, { useState } from 'react'

export default function Composer({ onSend, disabled }:{ onSend:(t:string)=>void, disabled?: boolean }) {
  const [text, setText] = useState('')

  const submit = () => {
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }

  return (
    <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #eee' }}>
      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        placeholder="问点什么……"
        rows={2}
        style={{ flex: 1, fontSize: 14, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
        disabled={disabled}
      />
      <button onClick={submit} disabled={disabled} style={{ padding: '8px 14px', borderRadius: 8 }}>
        发送
      </button>
    </div>
  )
}
