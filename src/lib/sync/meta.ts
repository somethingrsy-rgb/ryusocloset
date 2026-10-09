/** 동기화 보조 정보: 키마다 마지막으로 고친 시각, 아직 원격에 알리지 못한 삭제. localStorage 'ryuso.sync.v1' */
const KEY = 'ryuso.sync.v1'

export interface SyncMeta {
  times: Record<string, number>
  pendingDeletes: { c: 'items' | 'roomItems'; id: string }[]
  /** 이 기기가 처음 합류한 계정(uid). 합류 첫 동기화에서는 클라우드에 있는 데이터가 이긴다 */
  joined?: string
}

export function readMeta(): SyncMeta {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<SyncMeta>
    return {
      times: m.times && typeof m.times === 'object' ? m.times : {},
      pendingDeletes: Array.isArray(m.pendingDeletes) ? m.pendingDeletes : [],
      ...(typeof m.joined === 'string' ? { joined: m.joined } : {}),
    }
  } catch {
    return { times: {}, pendingDeletes: [] }
  }
}
export function writeMeta(m: SyncMeta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    /* 저장 공간 없음 */
  }
}
export const SYNC_KEY = KEY
export const isSyncKey = (k: string) => k.startsWith('ryuso.sync')

/** 이 키를 방금 고쳤다고 적는다 */
export function touch(key: string) {
  if (isSyncKey(key)) return
  const m = readMeta()
  m.times[key] = Date.now()
  writeMeta(m)
}
export function queueDelete(c: 'items' | 'roomItems', id: string) {
  const m = readMeta()
  if (!m.pendingDeletes.some((d) => d.c === c && d.id === id)) m.pendingDeletes.push({ c, id })
  writeMeta(m)
}
