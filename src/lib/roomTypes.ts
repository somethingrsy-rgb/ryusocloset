/** 방 화면 상수·타입 (논리 좌표계는 벽지 PNG 크기 1086×1448) */
export const ROOM_W = 1086
export const ROOM_H = 1448
/** 바닥 PNG 를 방 폭에 맞췄을 때의 높이 (1983×793 → 1086 폭) */
export const FLOOR_H = 434
/** 캠핑 탭의 잔디 높이 (배경 그림이 더 위에서 끝나서 잔디를 더 위부터 깐다) */
export const CAMP_FLOOR_H = 500
/** 아바타 캔버스(1024×1536)를 방에 놓을 때 기본 폭 (캐릭터 키 ≈ 방 높이의 40%) */
export const AVATAR_BASE_W = 396
/** 아바타 캔버스에서 발바닥이 끝나는 높이 비율 — 방에서 아바타의 기준점(y)은 발바닥이다 */
export const AVATAR_FEET_RATIO = 1508 / 1536
export const MAX_PLACED = 40
/** 방 폭(0~ROOM_W) 밖, 화면 양옆 배경 위에도 물건을 놓을 수 있는 최대 거리 (논리 px). 실제로는 화면에 보이는 범위까지만 옮겨진다 */
export const ROOM_EXTRA = 700
export const MIN_SCALE = 0.3
export const MAX_SCALE = 3

export const ROOM_GROUPS = ['furniture', 'wall', 'light', 'camp', 'theme', 'background'] as const
/** furniture 탭에는 rug(러그)도 함께 보인다 */
export type RoomTab = (typeof ROOM_GROUPS)[number]
export type RoomGroup = 'furniture' | 'rug' | 'wall' | 'light' | 'camp'

export interface RoomItemDef {
  id: string
  group: RoomGroup
  /** 테마 소품이면 테마 id (내 방 '테마' 탭에만 보인다. group 은 겹치는 순서만 정한다) */
  theme?: string
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
  /** 내 방의 벽지·바닥 (테마 id, 없으면 기본). 벽과 바닥을 따로 고른다 */
  wallId?: string
  floorId?: string
  /** 캠핑 탭: true 면 밤 배경 */
  night?: boolean
  avatar: AvatarPlacement
  items: Placed[]
}

/** 선택 대상: 배치된 물건의 uid 또는 아바타 */
export type Selection = { kind: 'item'; uid: string } | { kind: 'avatar' } | null
