import React from 'react'
import type { TarotCard } from '../types'

export default function TarotBoard({ cards }: { cards: TarotCard[] }) {
  if (!cards?.length) return null

  return (
    <div style={{ padding: 12 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(cards.length, 5)}, 1fr)`,
        gap: 12
      }}>
        {cards.map((c, idx) => (
          <div key={idx} style={{
            borderRadius: 12,
            border: '1px solid #e5e5e5',
            padding: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            background: '#fff'
          }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>{c.slot}</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{c.cn} / {c.name}</div>
            <div style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 999,
              background: c.upright ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${c.upright ? '#10b98133' : '#ef444433'}`,
              fontSize: 12,
              marginBottom: 6
            }}>
              {c.upright ? '正位' : '逆位'}
            </div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
              {c.meanings?.slice(0, 3).join('、')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
