import { useEffect, useState } from 'react'
import { clockAt, skipToNext, type Clock } from '../lib/daynight'

/** 1초마다 게임 시계를 갱신한다. skip() 은 다음 시간대로 건너뛴다. */
export function useClock(): { clock: Clock; skip: () => void } {
  const [clock, setClock] = useState(() => clockAt(Date.now()))
  useEffect(() => {
    const id = window.setInterval(() => setClock(clockAt(Date.now())), 1000)
    return () => window.clearInterval(id)
  }, [])
  return {
    clock,
    skip: () => {
      skipToNext(Date.now())
      setClock(clockAt(Date.now()))
    },
  }
}
