import type { Boss, ChatMsg, Food, Home, PlayerState } from './core'

/** 보낼 내 상태 일부(host·eat 은 null 이면 지운다) */
export type PlayerPart = Partial<Omit<PlayerState, 't' | 'host' | 'eat'>> & { host?: string | null; eat?: string | null }

/** 실시간 연결 한 가지(Firebase 또는 탭끼리 시험용). 세션(session.ts)은 이것만 안다 */
export interface Transport {
  /** 같이 놀기에 들어간다(앱 어디에 있든 하나). 이미 10명이면 full */
  join(me: Omit<PlayerState, 't'>): Promise<{ uid: string; full: boolean }>
  update(me: PlayerPart): void
  /** home 이면 내 집 초대 글 */
  chat(name: string, text: string, home?: boolean, race?: string): void
  leave(): void
  onPlayers(cb: (players: Record<string, PlayerState>) => void): void
  onChat(cb: (msgs: ChatMsg[]) => void): void
  /** 같이 사냥하는 대왕 몬스터(없으면 null) */
  /** 같이 사냥하는 대왕 몬스터(장소마다 하나: walk·farm·cafe) */
  onBosses(cb: (bosses: Record<string, Boss>) => void): void
  /** 대왕 몬스터에게 마법 한 번(동시에 여럿이 쳐도 하나도 빠지지 않게) */
  hitBoss(room: string, id: string, power: number): void
  /** 새 대왕 몬스터를 낸다(없거나 풀리고 조금 지났을 때만, 여럿이 동시에 해도 하나만) */
  spawnBoss(room: string, next: Omit<Boss, 't'>): void
  /** 내 집을 친구들에게 연다(방 꾸밈을 올린다, 접속이 끊기면 닫힌다) / 닫는다 */
  openHome(home: Omit<Home, 't'>): void
  closeHome(): void
  /** 누구네 집(방 꾸밈 + 바닥 음식)을 지켜본다. 돌려준 함수로 그만 본다 */
  watchHome(host: string, cb: (home: Home | null, foods: Food[]) => void): () => void
  addFood(host: string, food: Omit<Food, 'id' | 't'>): void
  /** 음식을 먹는다(바닥에서 없어진다) */
  eatFood(host: string, id: string): void
  /** 서버 시각 - 내 시각(ms): 오래된 플레이어를 가려낼 때 */
  offset(): number
}
