import { notifyItemsChanged } from './items'
import { isRestoring } from './restoreGuard'

/**
 * 기본 옷·방 물건을 "삭제"하면 실제 파일을 지우는 대신 목록에서 숨긴다 (이미 저장해 둔 코디·방은 그대로 보인다).
 * 숨긴 것은 '되돌리기' 로 다시 꺼낼 수 있다. 내가 추가한 것은 숨기지 않고 진짜로 지운다 (customItems.ts).
 */
const KEY = 'ryuso.hidden.v1'

function read(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

let hidden = read()
const save = () => {
  if (isRestoring()) return
  try {
    localStorage.setItem(KEY, JSON.stringify([...hidden]))
  } catch {
    /* 저장 공간이 없으면 이번 접속에서만 숨겨진다 */
  }
}

export const isHidden = (id: string) => hidden.has(id)
export const hiddenCount = (ids: Iterable<string>) => [...ids].filter((id) => hidden.has(id)).length

export function hideItem(id: string) {
  hidden = new Set(hidden).add(id)
  save()
  notifyItemsChanged()
}

/** 주어진 id 들만 다시 보이게 한다 */
export function restoreItems(ids: Iterable<string>) {
  const next = new Set(hidden)
  for (const id of ids) next.delete(id)
  hidden = next
  save()
  notifyItemsChanged()
}

export const visible = <T extends { id: string }>(list: T[]): T[] => list.filter((i) => !hidden.has(i.id))
