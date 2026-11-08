import type { Boss, ChatMsg, PlayerState } from './core'

/** 실시간 연결 한 가지(Firebase 또는 탭끼리 시험용). 세션(session.ts)은 이것만 안다 */
export interface Transport {
  /** 같이 놀기에 들어간다(앱 어디에 있든 하나). 이미 10명이면 full */
  join(me: Omit<PlayerState, 't'>): Promise<{ uid: string; full: boolean }>
  update(me: Partial<Omit<PlayerState, 't'>>): void
  chat(name: string, text: string): void
  leave(): void
  onPlayers(cb: (players: Record<string, PlayerState>) => void): void
  onChat(cb: (msgs: ChatMsg[]) => void): void
  /** 같이 사냥하는 대왕 몬스터(없으면 null) */
  onBoss(cb: (boss: Boss | null) => void): void
  /** 대왕 몬스터에게 마법 한 번(동시에 여럿이 쳐도 하나도 빠지지 않게) */
  hitBoss(id: string, power: number): void
  /** 새 대왕 몬스터를 낸다(없거나 풀리고 조금 지났을 때만, 여럿이 동시에 해도 하나만) */
  spawnBoss(next: Omit<Boss, 't'>): void
  /** 서버 시각 - 내 시각(ms): 오래된 플레이어를 가려낼 때 */
  offset(): number
}
