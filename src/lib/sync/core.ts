/**
 * 동기화의 순수한 규칙 (Firebase 와 상관없이 시험할 수 있다).
 * 키-값(코디·방 등)은 "나중에 고친 쪽이 이긴다", 내가 추가한 옷·소품은 합집합 + 삭제 표시(tombstone).
 */
export interface Remote {
  v: string
  t: number
}
export interface KvPlan {
  /** 원격 값으로 이 기기를 바꿀 키 */
  pull: { key: string; v: string; t: number }[]
  /** 이 기기 값을 원격에 올릴 키 */
  push: { key: string; t: number }[]
}

/** 이 기기에서 한 번도 동기화·수정한 적 없는 데이터의 시각: 어떤 실제 수정보다 오래된 것으로 본다 */
export const UNKNOWN_T = 1

export function planKv(local: Record<string, string>, localTimes: Record<string, number>, remote: Record<string, Remote>): KvPlan {
  const pull: KvPlan['pull'] = []
  const push: KvPlan['push'] = []
  for (const [key, r] of Object.entries(remote)) {
    const lt = key in local ? (localTimes[key] ?? UNKNOWN_T) : 0
    if (r.t > lt) pull.push({ key, v: r.v, t: r.t })
    else if (r.t < lt) push.push({ key, t: lt })
  }
  for (const key of Object.keys(local)) {
    if (!(key in remote)) push.push({ key, t: localTimes[key] ?? UNKNOWN_T })
  }
  return { pull, push }
}

export interface CustomRemote {
  id: string
  del: boolean
}
export interface CustomPlan {
  /** 원격에서 받아 올 것 */
  add: string[]
  /** 이 기기에서 지울 것 (원격에서 삭제됨) */
  remove: string[]
  /** 원격에 올릴 것 */
  push: string[]
  /** 원격에 삭제 표시를 남길 것 */
  tombstone: string[]
}

/** localIds: 이 기기에 있는 id, pendingDeletes: 이 기기에서 지웠는데 아직 원격에 알리지 못한 id */
export function planCustom(localIds: string[], pendingDeletes: string[], remote: CustomRemote[]): CustomPlan {
  const local = new Set(localIds)
  const pending = new Set(pendingDeletes)
  const byId = new Map(remote.map((r) => [r.id, r]))
  const plan: CustomPlan = { add: [], remove: [], push: [], tombstone: [] }
  for (const id of pending) plan.tombstone.push(id)
  for (const r of remote) {
    if (pending.has(r.id)) continue
    if (r.del) {
      if (local.has(r.id)) plan.remove.push(r.id)
    } else if (!local.has(r.id)) plan.add.push(r.id)
  }
  for (const id of local) if (!byId.has(id) && !pending.has(id)) plan.push.push(id)
  return plan
}
