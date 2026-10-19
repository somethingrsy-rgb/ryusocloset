import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { actFarm } from '../lib/farm'
import { COINS_PER_SET, COLORS, SIZE, applyMove, findMove, isOver, newGame, setsOf, undo, type Game, type Pos } from '../lib/jumpPuzzle'
import { CoinIcon } from './Icons'

const KEY = 'ryuso.jumppuzzle.v1'
const loadBest = () => { try { const n = Number(localStorage.getItem(KEY)); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0 } catch { return 0 } }
/** 네 색: 빨강·초록·파랑·주황 (색마다 가운데 무늬가 달라서 색을 구분하기 어려워도 알 수 있다) */
const FILL = ['#ef5a3c', '#7cc545', '#4aa6ea', '#f5a623']
const DARK = ['#b8381f', '#4f9526', '#2a78b8', '#c27d0c']
const MARK = ['●', '▲', '■', '★']

const T = {
  ko: { title: '점프 퍼즐', how: '말을 눌러 고른 뒤, 이웃한 말을 뛰어넘어 빈칸을 눌러요. 뛰어넘은 말은 내 것이 돼요. 네 색을 하나씩 모으면 한 세트!', undo: '되돌리기', again: '새 판', close: '닫기', sets: '세트', best: '최고 기록', badMove: '그곳으로는 뛸 수 없어요', over: '더 뛸 수 없어요!', result: (n: number) => `${n}세트 완성!`, got: (c: number) => `+${c} 코인`, new: '새 기록!' },
  en: { title: 'Jump Puzzle', how: 'Tap a piece, then tap an empty spot beyond a neighbor to jump it and keep it. Collect one of each color for a set!', undo: 'Undo', again: 'New game', close: 'Close', sets: 'sets', best: 'Best', badMove: "You can't jump there", over: 'No more jumps!', result: (n: number) => `${n} sets!`, got: (c: number) => `+${c} coins`, new: 'New best!' },
}

export function JumpPuzzle({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n()
  const tx = T[lang]
  const [game, setGame] = useState<Game>(() => newGame())
  const [sel, setSel] = useState<Pos | null>(null)
  const [paid, setPaid] = useState(0) // 이 판에서 코인을 이미 받은 세트 수 (되돌렸다 다시 해도 같은 세트는 한 번만)
  const [best, setBest] = useState(loadBest)
  const [msg, setMsg] = useState('')
  const [fresh, setFresh] = useState(false)
  const msgTimer = useRef<number>(0)
  useEffect(() => () => clearTimeout(msgTimer.current), [])
  const say = (t: string) => { setMsg(t); clearTimeout(msgTimer.current); msgTimer.current = window.setTimeout(() => setMsg(''), 1800) }

  const sets = setsOf(game.pocket)
  const over = isOver(game.board)

  const finish = (g: Game) => {
    const n = setsOf(g.pocket)
    if (n > best) {
      setBest(n); setFresh(true)
      try { localStorage.setItem(KEY, String(n)) } catch { /* 저장 실패는 무시 */ }
    }
  }
  const tap = (r: number, c: number) => {
    if (over) return
    const v = game.board[r][c]
    if (v !== 0) { setSel(sel && sel.r === r && sel.c === c ? null : { r, c }); return }
    if (!sel) return
    const m = findMove(game.board, sel, { r, c })
    if (!m) { say(tx.badMove); setSel(null); return }
    const next = applyMove(game, m)
    setGame(next); setSel(null)
    const n = setsOf(next.pocket)
    if (n > paid) { actFarm({ type: 'earn', amount: (n - paid) * COINS_PER_SET }); setPaid(n); say(tx.got((n - paid) * COINS_PER_SET)) }
    if (isOver(next.board)) finish(next)
  }
  const doUndo = () => { setGame((g) => undo(g)); setSel(null); setFresh(false) }
  const restart = () => { setGame(newGame()); setSel(null); setPaid(0); setFresh(false); setMsg('') }

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl bg-[#faf9f2] text-[#213f35] ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2 border-b border-[#e2e7dc] px-4 py-2">
        <h2 className="m-0 text-xl font-normal [font-family:Jua,'Noto_Sans_KR',sans-serif]">🔴 {tx.title}</h2>
        <button onClick={onClose} aria-label={tx.close} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dce4d7] bg-white text-xl text-[#246f55]">✕</button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-3 py-2">
        <div className="flex w-full max-w-[34rem] items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm">
          <div className="flex gap-2" aria-label="pocket">
            {Array.from({ length: COLORS }, (_, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold text-white" style={{ background: FILL[i] }}><span aria-hidden>{MARK[i]}</span>{game.pocket[i]}</span>
            ))}
          </div>
          <div className="text-right text-xs leading-tight font-bold"><div className="text-base text-[#246f55]">{sets} {tx.sets}</div><div className="text-[#678071]">{tx.best} {best}</div></div>
        </div>

        <div role="grid" aria-label={tx.title} className="grid aspect-square w-full max-w-[min(34rem,calc(100dvh-20rem))] gap-[3px] rounded-2xl bg-[#d9e3cf] p-1.5" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {game.board.flatMap((row, r) => row.map((v, c) => {
            const picked = sel && sel.r === r && sel.c === c
            return (
              <button
                key={`${r}-${c}`}
                role="gridcell"
                aria-label={v ? `${r + 1}-${c + 1} ${MARK[v - 1]}` : `${r + 1}-${c + 1}`}
                onClick={() => tap(r, c)}
                className={`flex aspect-square items-center justify-center rounded-lg border-0 p-[8%] ${v === 0 ? 'bg-[#eef3e6]' : 'bg-[#f6f9f0]'}`}
              >
                {v !== 0 && (
                  <span
                    className={`flex h-full w-full items-center justify-center rounded-full text-[min(3.2vw,1.1rem)] font-black text-white/80 shadow-[inset_0_-3px_0_rgba(0,0,0,.18)] transition ${picked ? 'scale-110 ring-4 ring-[#213f35]' : ''}`}
                    style={{ background: FILL[v - 1], border: `2px solid ${DARK[v - 1]}` }}
                  >{MARK[v - 1]}</span>
                )}
              </button>
            )
          }))}
        </div>

        <p className="m-0 min-h-5 text-center text-sm font-bold text-[#246f55]" role="status" aria-live="polite">{msg}</p>
        {game.history.length === 0 && !msg && <p className="m-0 max-w-[34rem] text-center text-xs leading-relaxed text-[#678071]">{tx.how}</p>}

        <div className="flex gap-2">
          <button onClick={doUndo} disabled={game.history.length === 0} className="min-h-11 rounded-full border border-[#dce4d7] bg-white px-5 text-sm font-bold disabled:opacity-40">↩ {tx.undo}</button>
          <button onClick={restart} className="min-h-11 rounded-full bg-[#246f55] px-5 text-sm font-bold text-white">🔄 {tx.again}</button>
        </div>
      </div>

      {over && (
        <div role="dialog" aria-label={tx.over} className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-6">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="m-0 text-lg font-extrabold">{tx.over}</p>
            <p className="m-0 text-3xl font-extrabold text-[#246f55]">{tx.result(sets)}</p>
            <p className="m-0 flex items-center gap-1 text-sm font-bold text-[#c9751f]">{tx.got(paid * COINS_PER_SET)} <CoinIcon /></p>
            {fresh && <p className="m-0 text-sm font-bold text-[#e8707f]">🎉 {tx.new}</p>}
            <div className="flex gap-2">
              <button onClick={doUndo} className="min-h-11 rounded-full border border-[#dce4d7] bg-white px-4 text-sm font-bold">↩ {tx.undo}</button>
              <button onClick={restart} className="min-h-11 rounded-full bg-[#246f55] px-4 text-sm font-bold text-white">🔄 {tx.again}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
