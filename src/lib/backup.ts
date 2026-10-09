import { exportCustom, replaceCustom } from './customItems'
import { beginRestore, endRestore } from './restoreGuard'
import { isSyncKey, touch } from './sync/meta'

/**
 * 이 기기의 모든 데이터(코디·저장한 코디·방·캠핑·설정·숨긴 목록 + 내가 추가한 옷·소품)를 파일 하나로 묶거나,
 * 그런 파일로 이 기기를 바꾼다. 다른 기기로 옮기거나 지워질 때를 대비한 백업이자 수동 동기화다.
 */
const APP = 'ryuso-closet-backup'
const VERSION = 1
const PREFIX = 'ryuso.'

export interface BackupFile {
  app: typeof APP
  version: number
  createdAt: number
  /** localStorage 의 'ryuso.' 키 → 저장된 문자열 그대로 */
  local: Record<string, string>
  custom: { items: unknown[]; roomItems: unknown[] }
}

export async function makeBackup(): Promise<BackupFile> {
  const local: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      const v = k?.startsWith(PREFIX) && !isSyncKey(k) ? localStorage.getItem(k) : null
      if (k && v !== null) local[k] = v
    }
  } catch {
    /* 저장소를 못 읽는 환경 */
  }
  return { app: APP, version: VERSION, createdAt: Date.now(), local, custom: await exportCustom() }
}

export const backupName = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `ryuso-closet-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
}

/** 파일 내용을 검사한다. 이 앱의 백업이 아니면 null */
export function parseBackup(text: string): BackupFile | null {
  try {
    const b = JSON.parse(text) as Partial<BackupFile>
    if (!b || b.app !== APP || typeof b.version !== 'number' || b.version > VERSION) return null
    if (!b.local || typeof b.local !== 'object' || !b.custom || !Array.isArray(b.custom.items) || !Array.isArray(b.custom.roomItems)) return null
    const local: Record<string, string> = {}
    for (const [k, v] of Object.entries(b.local)) if (k.startsWith(PREFIX) && typeof v === 'string') local[k] = v
    return { app: APP, version: b.version, createdAt: Number(b.createdAt) || 0, local, custom: { items: b.custom.items, roomItems: b.custom.roomItems } }
  } catch {
    return null
  }
}

/** 이 기기의 데이터를 백업 내용으로 바꾼다 (기존 'ryuso.' 데이터는 지운다). 끝나면 화면을 다시 불러와야 반영된다. */
export async function restoreBackup(b: BackupFile): Promise<boolean> {
  beginRestore()
  const ok = await replaceCustom(b.custom.items, b.custom.roomItems)
  if (!ok) {
    endRestore()
    return false
  }
  try {
    const old: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX) && !isSyncKey(k)) old.push(k)
    }
    old.forEach((k) => localStorage.removeItem(k))
    for (const [k, v] of Object.entries(b.local)) {
      localStorage.setItem(k, v)
      touch(k) // 불러온 데이터를 "방금 고친 것"으로 표시해서 동기화가 켜져 있으면 다른 기기로 퍼지게 한다
    }
    return true
  } catch {
    endRestore()
    return false
  }
}
