import React from 'react'
import { Message } from '../types'

export default function MessageList({ messages }: { messages: Message[] | {role: string, content: string}[] }) {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.map((m: any, idx: number) => (
        <div key={m.id ?? idx}
             style={{
               alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
               background: m.role === 'user' ? '#daf0ff' : '#f2f2f2',
               borderRadius: 12,
               padding: '10px 12px',
               maxWidth: '80%',
               whiteSpace: 'pre-wrap'
             }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>{m.role}</div>
          <div>{m.content}</div>
        </div>
      ))}
    </div>
  )
}
