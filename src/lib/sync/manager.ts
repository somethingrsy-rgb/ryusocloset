import { useSyncExternalStore } from 'react'
import { customIds, deleteCustomRaw, getCustomRaw, putCustomRaw } from '../customItems'
import { beginRestore } from '../restoreGuard'
import { syncAvailable } from './config'
import { onLocalChange } from './bus'
import { UNKNOWN_T, planCustom, planKv } from './core'
import { isSyncKey, readMeta, writeMeta } from './meta'
import * as remote from './remote'

export type SyncState = 'off' | 'signedout' | 'syncing' | 'ok' | 'error'
export interface SyncStatus {
  state: SyncState
  email: string | null
  /** 마지막으로 성공한 시각 */
  last: number | null
  /** 사람이 읽을 오류 열쇠 (i18n) */
  errorKey: string | null
  /** 용량 때문에 올리지 못한 그림 수 */
  skipped: number
}

let status: SyncStatus = { state: syncAvailable ? 'signedout' : 'off', email: null, last: null, errorKey: null, skipped: 0 }
const subs = new Set<() => void>()
const set = (p: Partial<SyncStatus>) => {
  status = { ...status, ...p }
  subs.forEach((f) => f())
}
export const useSyncStatus = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => status,
  )

let uid: string | null = null
let running = false
let again = false
let timer: number | undefined

const localKv = () => {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('ryuso.') && !isSyncKey(k)) out[k] = localStorage.getItem(k) ?? ''
  }
  return out
}

/** 이 기기와 클라우드를 맞춘다. 클라우드가 더 새것이면 이 기기를 바꾸고 화면을 다시 불러온다. */
export async function syncNow(): Promise<void> {
  if (!uid) return
  if (running) {
    again = true
    return
  }
  running = true
  set({ state: 'syncing', errorKey: null })
  const me = uid
  try {
    let reload = false
    let skipped = 0
    // 1) 키-값
    const meta = readMeta()
    const local = localKv()
    // 이 계정에 처음 합류하는 기기: 이 기기가 앱을 켜면서 저장한 기본값이 클라우드의 진짜 데이터를 덮지 않도록, 클라우드에 있는 것은 클라우드가 이긴다
    const first = meta.joined !== me
    const plan = planKv(local, first ? {} : meta.times, await remote.fetchKv(me))
    if (plan.pull.length) {
      beginRestore() // 불러오는 동안 실행 중인 앱이 예전 값을 다시 저장하지 못하게
      for (const p of plan.pull) {
        localStorage.setItem(p.key, p.v)
        meta.times[p.key] = p.t
      }
      reload = true
    }
    for (const p of plan.push) {
      const t = p.t > UNKNOWN_T ? p.t : Date.now() // 시각을 모르는 데이터는 지금 올리는 시각으로 (아니면 다른 기기가 "같은 시각"이라며 안 받아간다)
      await remote.putKv(me, p.key, local[p.key], t)
      meta.times[p.key] = t
    }
    meta.joined = me
    writeMeta(meta)

    // 2) 내가 추가한 옷·소품
    const ids = customIds()
    for (const c of ['items', 'roomItems'] as const) {
      const m = readMeta()
      const pending = m.pendingDeletes.filter((d) => d.c === c).map((d) => d.id)
      const cp = planCustom(ids[c], pending, await remote.fetchCustomIndex(me, c))
      for (const id of cp.tombstone) await remote.putTombstone(me, c, id)
      for (const id of cp.push) {
        const v = await getCustomRaw(c, id)
        if (v && !(await remote.putCustom(me, c, id, v))) skipped++
      }
      for (const id of cp.add) {
        const v = await remote.fetchCustomOne(me, c, id)
        if (v && (await putCustomRaw(c, v))) reload = true
      }
      for (const id of cp.remove) {
        await deleteCustomRaw(c, id)
        reload = true
      }
      const m2 = readMeta()
      m2.pendingDeletes = m2.pendingDeletes.filter((d) => !(d.c === c && cp.tombstone.includes(d.id)))
      writeMeta(m2)
    }
    set({ state: 'ok', last: Date.now(), skipped })
    if (reload) {
      beginRestore()
      window.location.reload()
    }
  } catch (e) {
    set({ state: 'error', errorKey: remote.authErrorKey(e) })
  } finally {
    running = false
    if (again) {
      again = false
      void syncNow()
    }
  }
}

let started = false
/** 앱을 켤 때 한 번: 설정이 있으면 로그인 상태를 지켜보다가, 로그인되어 있으면 동기화하고 이후 변경·화면 복귀 때마다 맞춘다 */
export async function startSync(): Promise<void> {
  if (!syncAvailable || started) return
  started = true
  try {
    await remote.watchUser((email, id) => {
      uid = id
      if (!id) return set({ state: 'signedout', email: null })
      set({ email, state: 'syncing' })
      void syncNow()
    })
  } catch {
    set({ state: 'error', errorKey: 'syncErrGeneric' })
  }
  onLocalChange(() => {
    if (!uid) return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void syncNow(), 2500)
  })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow())
  window.addEventListener('online', () => void syncNow())
}

export async function signInWith(email: string, password: string, create: boolean): Promise<string | null> {
  try {
    await (create ? remote.signUp(email, password) : remote.signIn(email, password))
    return null
  } catch (e) {
    return remote.authErrorKey(e)
  }
}
export const signOutNow = () => remote.signOutUser()
