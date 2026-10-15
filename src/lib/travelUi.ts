import { useSyncExternalStore } from 'react'

/** 농장 같은 전체 화면 장면이 열려 있으면 여행 도감 패널을 숨긴다 */
let full = false
const subs = new Set<() => void>()
export function setTravelFull(v: boolean) {
  if (full === v) return
  full = v
  subs.forEach((f) => f())
}
export const useTravelFull = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => full)
