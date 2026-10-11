import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n'

/** One tap nudges once; holding repeats until release, cancellation or blur. */
function NudgeButton({ label, children, onMove }: { label: string; children: ReactNode; onMove: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null)
  const repeated = useRef(false)
  const action = useRef(onMove)
  action.current = onMove
  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    if (repeat.current !== null) clearInterval(repeat.current)
    timer.current = null; repeat.current = null
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop() }
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', hidden)
    return () => { stop(); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden) }
  }, [])
  return <button aria-label={label} title={label} className="flex h-11 w-11 touch-none items-center justify-center rounded-xl bg-petal text-lg active:bg-blush/30"
    onPointerDown={e => {
      if (e.button !== 0) return
      stop(); repeated.current = false; e.currentTarget.setPointerCapture(e.pointerId)
      timer.current = setTimeout(() => { repeated.current = true; action.current(); repeat.current = setInterval(() => action.current(), 100) }, 350)
    }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
    onClick={() => { if (!repeated.current) action.current(); repeated.current = false }}>
    {children}
  </button>
}
export function AdjustmentPanel({ name, onMove, onSmaller, onBigger, onClose, children }: {
  name: string; onMove: (x: number, y: number) => void; onSmaller: () => void; onBigger: () => void; onClose: () => void; children: ReactNode
}) {
  const { lang, t } = useI18n()
  const ko = lang === 'ko'
  return <div role="group" aria-label={ko ? '선택한 물건 조정' : 'Adjust selection'} className="absolute inset-x-2 bottom-2 z-30 max-h-[calc(100%-1rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-black/10 md:left-2 md:right-auto md:w-[290px]">
    <div className="flex min-w-0 items-center justify-between gap-2"><span className="min-w-0 truncate px-1 text-xs font-bold">{name}</span><button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-petal" aria-label={ko?'조정 닫기':'Close adjustments'} onClick={onClose}>✕</button></div>
    <div className="flex items-center justify-center gap-3">
      <div className="grid shrink-0 grid-cols-3 gap-1">
        <span/><NudgeButton label={t('moveUp')} onMove={() => onMove(0,-1)}>↑</NudgeButton><span/>
        <NudgeButton label={ko?'왼쪽으로 조금 이동':'Move slightly left'} onMove={() => onMove(-1,0)}>←</NudgeButton>
        <span className="flex h-11 w-11 items-center justify-center text-[10px] font-bold text-cocoa-soft">{ko?'이동':'Move'}</span>
        <NudgeButton label={ko?'오른쪽으로 조금 이동':'Move slightly right'} onMove={() => onMove(1,0)}>→</NudgeButton>
        <span/><NudgeButton label={t('moveDown')} onMove={() => onMove(0,1)}>↓</NudgeButton><span/>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-1"><button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-petal text-xl" aria-label={t('smaller')} onClick={onSmaller}>−</button><span className="text-xs font-bold">{ko?'크기':'Size'}</span><button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-petal text-xl" aria-label={t('bigger')} onClick={onBigger}>+</button></div>
        <span className="text-center text-[10px] text-cocoa-soft">{ko?'방향키를 꾹 누르면 연속 이동':'Hold an arrow to keep moving'}</span>
      </div>
    </div>
    <details className="mt-1"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-xl bg-petal text-xs font-bold">⋯ {ko?'더보기':'More'}</summary><div className="mt-2 grid grid-cols-3 gap-2">{children}</div></details>
  </div>
}
