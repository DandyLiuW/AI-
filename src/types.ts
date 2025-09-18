export type Message = {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export type Session = {
  id: string
  name: string
  created_at: string
}

/** 单张塔罗牌（含正逆位与位点） */
export type TarotCard = {
  slot: string          // 位点，如 过去/现在/未来
  id: string
  name: string
  cn: string
  upright: boolean
  meanings: string[]    // 该正/逆位的关键词（来自后端）
}

export type TarotDrawResp = {
  spread: 'three' | 'celtic'
  cards: TarotCard[]
}
