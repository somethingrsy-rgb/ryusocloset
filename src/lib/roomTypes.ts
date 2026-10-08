/** 방 화면 상수·타입 (논리 좌표계는 벽지 PNG 크기 1086×1448) */
export const ROOM_W = 1086
export const ROOM_H = 1448
/** 바닥 PNG 를 방 폭에 맞췄을 때의 높이 (1983×793 → 1086 폭) */
export const FLOOR_H = 434
/** 아바타 캔버스(851×1280)를 방에 놓을 때 기본 폭 (캐릭터 키 ≈ 방 높이의 40%) */
export const AVATAR_BASE_W = 386
export const MAX_PLACED = 40
export const MIN_SCALE = 0.3
export const MAX_SCALE = 3

export const ROOM_GROUPS = ['furniture', 'wall', 'light'] as const
/** furniture 탭에는 rug(러그)도 함께 보인다 */
export type RoomTab = (typeof ROOM_GROUPS)[number]
export type RoomGroup = 'furniture' | 'rug' | 'wall' | 'light'

export interface RoomItemDef {
  id: string
  group: RoomGroup
  name: { ko: string; en: string }
  /** 투명 여백을 잘라낸 webp (public 기준 상대 경로) */
  image: string
  thumb: string
  /** 잘라낸 이미지의 원본 픽셀 크기 */
  w: number
  h: number
  /** 배치 시 기본 표시 폭 (논리 px) */
  baseWidth: number
  /** 기본 배치 위치 — 이미지 아래 가운데가 기준점 */
  x: number
  y: number
}

export interface Placed {
  uid: string
  itemId: string
  /** 기준점(아래 가운데) */
  x: number
  y: number
  scale: number
  flip: boolean
}

export interface AvatarPlacement {
  x: number
  y: number
  scale: number
  flip: boolean
}

export interface RoomState {
  avatar: AvatarPlacement
  items: Placed[]
}

/** 선택 대상: 배치된 물건의 uid 또는 아바타 */
export type Selection = { kind: 'item'; uid: string } | { kind: 'avatar' } | null
