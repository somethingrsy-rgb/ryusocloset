import type { ChatMsg, PlayerState, Room } from './core'

/** 실시간 연결 한 가지(Firebase 또는 탭끼리 시험용). 세션(session.ts)은 이것만 안다 */
export interface Transport {
  /** 방에 들어간다. 이미 10명이면 full */
  join(room: Room, me: Omit<PlayerState, 't'>): Promise<{ uid: string; full: boolean }>
  update(me: Partial<Omit<PlayerState, 't'>>): void
  chat(name: string, text: string): void
  leave(): void
  onPlayers(cb: (players: Record<string, PlayerState>) => void): void
  onChat(cb: (msgs: ChatMsg[]) => void): void
  /** 서버 시각 - 내 시각(ms): 오래된 플레이어를 가려낼 때 */
  offset(): number
}
