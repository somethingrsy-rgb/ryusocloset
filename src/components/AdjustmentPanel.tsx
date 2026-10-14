import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from './Modal'
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
  return <button aria-label={label} title={label} className="flex h-11 w-11 touch-none items-center justify-center pointer-events-auto rounded-full bg-white/85 text-lg shadow-sm ring-1 ring-black/10 active:bg-blush/30"
    onPointerDown={e => {
      if (e.button !== 0) return
      stop(); repeated.current = false; e.currentTarget.setPointerCapture(e.pointerId)
      timer.current = setTimeout(() => { repeated.current = true; action.current(); repeat.current = setInterval(() => action.current(), 100) }, 350)
    }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
    onClick={() => { if (!repeated.current) action.current(); repeated.current = false }}>
    {children}
  </button>
}
export function AdjustmentPanel({ name, onMove, onSmaller, onBigger, onClose, onRemove, removeLabel, lift = false, children }: {
  name: string; onMove: (x: number, y: number) => void; onSmaller: () => void; onBigger: () => void; onClose: () => void; onRemove?: () => void; removeLabel?: string; lift?: boolean; children: ReactNode
}) {
  const { lang, t } = useI18n()
  const ko = lang === 'ko'
  const [more, setMore] = useState(false)
  const host = document.getElementById('adjustment-controls')
  const button = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-petal text-xl'
  return <>
    <div role="group" aria-label={ko?'미세 이동 방향키':'Fine movement controls'} className={`pointer-events-none absolute right-2 ${lift ? 'bottom-16' : 'bottom-2'} z-30 grid grid-cols-3 gap-0.5`}>
      <span/><NudgeButton label={t('moveUp')} onMove={() => onMove(0,-1)}>↑</NudgeButton><span/>
      <NudgeButton label={ko?'왼쪽으로 조금 이동':'Move slightly left'} onMove={() => onMove(-1,0)}>←</NudgeButton>
      <button className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/60 text-xs ring-1 ring-black/5" aria-label={ko?'선택 해제':'Deselect'} onClick={onClose}>✕</button>
      <NudgeButton label={ko?'오른쪽으로 조금 이동':'Move slightly right'} onMove={() => onMove(1,0)}>→</NudgeButton>
      <span/><NudgeButton label={t('moveDown')} onMove={() => onMove(0,1)}>↓</NudgeButton><span/>
    </div>
    <div role="group" aria-label={ko?'크기·삭제':'Size and remove'} className={`pointer-events-none absolute ${lift ? 'bottom-16' : 'bottom-2'} left-2 z-30 flex gap-0.5`}>
      {onRemove ? <button className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-blush text-white shadow-sm" aria-label={removeLabel ?? t('remove')} title={removeLabel ?? t('remove')} onClick={onRemove}>🗑️</button> : null}
      <button className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl shadow-sm ring-1 ring-black/10" aria-label={t('smaller')} onClick={onSmaller}>−</button>
      <button className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl shadow-sm ring-1 ring-black/10" aria-label={t('bigger')} onClick={onBigger}>+</button>
    </div>
    {host && createPortal(<>
    <div role="group" aria-label={`${ko ? '선택한 물건 조정' : 'Adjust selection'}: ${name}`} className="flex items-center gap-1 overflow-x-auto overscroll-contain border-b border-black/5 bg-white px-2 py-1">
      <span className="min-w-0 flex-1 truncate text-xs font-bold">{name}</span>
      <button className={button} aria-label={ko?'조정 더보기':'More adjustments'} onClick={() => setMore(true)}>⋯</button>
    </div>
    {more && <Modal title={name} onClose={() => setMore(false)}>
      <div className="grid grid-cols-3 gap-2">{children}</div>
      <button className="mt-3 min-h-11 w-full rounded-xl bg-petal text-sm font-bold" onClick={() => { setMore(false); onClose() }}>{ko?'선택 해제 · 조정 닫기':'Deselect · close adjustments'}</button>
    </Modal>}
  </>, host)}
  </>
}
