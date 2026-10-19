import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { actFarm } from '../lib/farm'
import { assetUrl } from '../lib/items'
import { COINS_PER_SET, COLORS, SIZE, WIN_BONUS, applyMove, findMove, isOver, newGame, newVs, planCpuTurn, setsOf, undo, vsCpuMove, vsEndTurn, vsHumanMove, vsResult, type Game, type Pos, type Vs } from '../lib/jumpPuzzle'
import { CoinIcon } from './Icons'

const KEY = 'ryuso.jumppuzzle.v1'
const loadBest = () => { try { const n = Number(localStorage.getItem(KEY)); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0 } catch { return 0 } }
/** 네 색: 빨강·초록·파랑·주황 (색마다 가운데 무늬가 달라서 색을 구분하기 어려워도 알 수 있다) */
const FILL = ['#ef5a3c', '#7cc545', '#4aa6ea', '#f5a623']
const DARK = ['#b8381f', '#4f9526', '#2a78b8', '#c27d0c']
const MARK = ['●', '▲', '■', '★']
const CPU_STEP_MS = 700

const T = {
  ko: {
    title: '점프 퍼즐', how: '말을 눌러 고른 뒤, 이웃한 말을 뛰어넘어 빈칸을 눌러요. 뛰어넘은 말은 내 것이 돼요. 네 색을 하나씩 모으면 한 세트!',
    howVs: '내 차례에 말을 뛰어넘어 모아요. 이어서 더 뛸 수 있으면 계속하거나 끝내기를 눌러요. 컴퓨터보다 세트를 많이 모으면 이겨요!',
    undo: '되돌리기', again: '새 판', close: '닫기', sets: '세트', best: '최고 기록', badMove: '그곳으로는 뛸 수 없어요', over: '더 뛸 수 없어요!',
    result: (n: number) => `${n}세트 완성!`, got: (c: number) => `+${c} 코인`, new: '새 기록!',
    solo: '혼자', vs: '컴퓨터와', you: '나', cpu: '컴퓨터', myTurn: '내 차례예요', cpuTurn: '컴퓨터 차례예요…', endTurn: '끝내기',
    win: '이겼어요!', lose: '아쉬워요, 졌어요', draw: '비겼어요', bonus: (c: number) => `이긴 보너스 +${c}`,
  },
  en: {
    title: 'Jump Puzzle', how: 'Tap a piece, then tap an empty spot beyond a neighbor to jump it and keep it. Collect one of each color for a set!',
    howVs: 'On your turn, jump and collect pieces. If you can jump again, keep going or end your turn. Beat the computer with more sets!',
    undo: 'Undo', again: 'New game', close: 'Close', sets: 'sets', best: 'Best', badMove: "You can't jump there", over: 'No more jumps!',
    result: (n: number) => `${n} sets!`, got: (c: number) => `+${c} coins`, new: 'New best!',
    solo: 'Solo', vs: 'Vs computer', you: 'You', cpu: 'Computer', myTurn: 'Your turn', cpuTurn: 'Computer is thinking…', endTurn: 'End turn',
    win: 'You win!', lose: 'You lost, try again', draw: "It's a tie", bonus: (c: number) => `Win bonus +${c}`,
  },
}

export function JumpPuzzle({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n()
  const tx = T[lang]
  const [mode, setMode] = useState<'solo' | 'vs'>('solo')
  const [game, setGame] = useState<Game>(() => newGame())
  const [vs, setVs] = useState<Vs>(() => newVs())
  const [sel, setSel] = useState<Pos | null>(null)
  const [paid, setPaid] = useState(0) // 이 판에서 코인을 이미 받은 세트 수 (되돌렸다 다시 해도 같은 세트는 한 번만)
  const [bonusPaid, setBonusPaid] = useState(0)
  const [best, setBest] = useState(loadBest)
  const [msg, setMsg] = useState('')
  const [fresh, setFresh] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const say = (t: string) => { setMsg(t); const id = window.setTimeout(() => setMsg(''), 1800); timers.current.push(id) }

  const solo = mode === 'solo'
  const board = solo ? game.board : vs.board
  const mine = solo ? game.pocket : vs.mine
  const sets = setsOf(mine)
  const over = isOver(board)
  const result = !solo && over ? vsResult(vs) : null

  // 컴퓨터 차례: 정해 둔 수를 하나씩 보여 주며 둔다
  useEffect(() => {
    if (solo || vs.turn !== 'cpu' || isOver(vs.board)) return
    const plan = planCpuTurn(vs.board, vs.cpu)
    const ids = plan.map((m, i) => window.setTimeout(() => setVs((v) => vsCpuMove(v, m, i === plan.length - 1)), CPU_STEP_MS * (i + 1)))
    return () => ids.forEach(clearTimeout)
  }, [solo, vs.turn, vs.board, vs.cpu])

  // 코인: 세트를 새로 모았을 때(되돌린 세트는 다시 주지 않음), 겨루기에서는 이긴 보너스도
  useEffect(() => {
    if (sets > paid) { actFarm({ type: 'earn', amount: (sets - paid) * COINS_PER_SET }); setPaid(sets); say(tx.got((sets - paid) * COINS_PER_SET)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets])
  useEffect(() => {
    if (result === 'win' && bonusPaid === 0) { actFarm({ type: 'earn', amount: WIN_BONUS }); setBonusPaid(WIN_BONUS) }
  }, [result, bonusPaid])
  useEffect(() => {
    if (solo && over && sets > best) {
      setBest(sets); setFresh(true)
      try { localStorage.setItem(KEY, String(sets)) } catch { /* 저장 실패는 무시 */ }
    }
  }, [solo, over, sets, best])

  const tap = (r: number, c: number) => {
    if (over || (!solo && vs.turn !== 'me')) return
    const v = board[r][c]
    if (v !== 0) {
      if (!solo && vs.chain && (vs.chain.r !== r || vs.chain.c !== c)) return // 이어 뛸 때는 방금 뛴 말만
      setSel(sel && sel.r === r && sel.c === c ? null : { r, c })
      return
    }
    if (!sel) return
    const m = findMove(board, sel, { r, c })
    if (!m) { say(tx.badMove); setSel(solo || !vs.chain ? null : vs.chain); return }
    setSel(null)
    if (solo) setGame((g) => applyMove(g, m))
    else {
      const next = vsHumanMove(vs, m)
      setVs(next)
      if (next.chain) setSel(next.chain)
    }
  }
  const doUndo = () => { setGame((g) => undo(g)); setSel(null); setFresh(false) }
  const endTurn = () => { setVs((v) => vsEndTurn(v)); setSel(null) }
  const restart = () => { setGame(newGame()); setVs(newVs()); setSel(null); setPaid(0); setBonusPaid(0); setFresh(false); setMsg('') }
  const switchMode = (m: 'solo' | 'vs') => { if (m !== mode) { setMode(m); restart() } }

  const turnText = solo ? '' : vs.turn === 'cpu' ? tx.cpuTurn : tx.myTurn // 화면 읽기용(위 큰 표시는 aria-hidden)
  const total = paid * COINS_PER_SET + bonusPaid

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl bg-[#faf9f2] text-[#213f35] ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2 border-b border-[#e2e7dc] px-4 py-2">
        <h2 className="m-0 text-xl font-normal [font-family:Jua,'Noto_Sans_KR',sans-serif]">🔴 {tx.title}</h2>
        <div role="radiogroup" aria-label="mode" className="flex rounded-full bg-[#e8efdc] p-0.5 text-sm font-bold">
          {(['solo', 'vs'] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => switchMode(m)} className={`min-h-9 rounded-full border-0 px-3 ${mode === m ? 'bg-[#246f55] text-white' : 'bg-transparent text-[#246f55]'}`}>{m === 'solo' ? tx.solo : tx.vs}</button>
          ))}
        </div>
        <button onClick={onClose} aria-label={tx.close} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dce4d7] bg-white text-xl text-[#246f55]">✕</button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-3 py-2">
        <div className="flex w-full max-w-[34rem] flex-col gap-1.5 rounded-2xl bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="w-16 shrink-0 text-xs font-bold text-[#678071]">{tx.you}</span>
            <div className="flex flex-1 gap-1.5" aria-label="pocket">
              {Array.from({ length: COLORS }, (_, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold text-white" style={{ background: FILL[i] }}><span aria-hidden>{MARK[i]}</span>{mine[i]}</span>
              ))}
            </div>
            <div className="text-right text-xs leading-tight font-bold"><div className="text-base text-[#246f55]">{sets} {tx.sets}</div>{solo && <div className="text-[#678071]">{tx.best} {best}</div>}</div>
          </div>
          {!solo && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex w-16 shrink-0 items-center gap-1 whitespace-nowrap text-xs font-bold text-[#678071]"><img src={assetUrl('assets/tabs/bunny.webp')} alt="" draggable={false} className="h-5 w-5 object-contain" />{tx.cpu}</span>
              <div className="flex flex-1 gap-1.5" aria-label="computer pocket">
                {Array.from({ length: COLORS }, (_, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold text-white" style={{ background: FILL[i] }}><span aria-hidden>{MARK[i]}</span>{vs.cpu[i]}</span>
                ))}
              </div>
              <div className="text-right text-base font-bold text-[#246f55]">{setsOf(vs.cpu)} {tx.sets}</div>
            </div>
          )}
        </div>

        <div role="grid" aria-label={tx.title} className={`grid aspect-square w-full max-w-[min(34rem,calc(100dvh-24rem))] gap-[3px] rounded-2xl bg-[#d9e3cf] p-1.5 transition-shadow ${!solo && !over && vs.turn === 'me' ? 'shadow-[0_0_0_4px_#7cc545,0_0_22px_6px_rgba(124,197,69,.55)]' : ''}`} style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))` }}>
          {board.flatMap((row, r) => row.map((v, c) => {
            const picked = sel && sel.r === r && sel.c === c
            return (
              <button
                key={`${r}-${c}`}
                role="gridcell"
                aria-label={v ? `${r + 1}-${c + 1} ${MARK[v - 1]}` : `${r + 1}-${c + 1}`}
                onClick={() => tap(r, c)}
                className={`flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border-0 p-[8%] ${v === 0 ? 'bg-[#eef3e6]' : 'bg-[#f6f9f0]'}`}
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

        <p className={`m-0 min-h-5 text-center text-sm font-bold text-[#246f55] ${!solo && !msg ? 'sr-only' : ''}`} role="status" aria-live="polite">{msg || turnText}</p>
        {!solo && !over && (
          <p
            className={`m-0 rounded-full px-6 py-2 text-center text-xl font-extrabold [font-family:Jua,'Noto_Sans_KR',sans-serif] ${vs.turn === 'me' ? 'jump-my-turn bg-[#246f55] text-white' : 'bg-[#eef0e8] text-[#678071]'}`}
            aria-hidden
          >{vs.turn === 'me' ? `✨ ${tx.myTurn} ✨` : tx.cpuTurn}</p>
        )}
        {(solo ? game.history.length === 0 : vs.mine.every((n) => n === 0) && vs.turn === 'me') && !msg && <p className="m-0 max-w-[34rem] text-center text-xs leading-relaxed text-[#678071]">{solo ? tx.how : tx.howVs}</p>}

        <div className="flex gap-2">
          {solo
            ? <button onClick={doUndo} disabled={game.history.length === 0} className="min-h-11 rounded-full border border-[#dce4d7] bg-white px-5 text-sm font-bold disabled:opacity-40">↩ {tx.undo}</button>
            : <button onClick={endTurn} disabled={!vs.chain || vs.turn !== 'me'} className="min-h-11 rounded-full border border-[#dce4d7] bg-white px-5 text-sm font-bold disabled:opacity-40">✋ {tx.endTurn}</button>}
          <button onClick={restart} className="min-h-11 rounded-full bg-[#246f55] px-5 text-sm font-bold text-white">🔄 {tx.again}</button>
        </div>
      </div>

      {over && (
        <div role="dialog" aria-label={tx.over} className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-6">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="m-0 text-lg font-extrabold">{result ? tx[result] : tx.over}</p>
            <p className="m-0 text-3xl font-extrabold text-[#246f55]">{result ? `${sets} : ${setsOf(vs.cpu)}` : tx.result(sets)}</p>
            <p className="m-0 flex items-center gap-1 text-sm font-bold text-[#c9751f]">{tx.got(total)} <CoinIcon /></p>
            {bonusPaid > 0 && <p className="m-0 text-xs font-bold text-[#678071]">{tx.bonus(bonusPaid)}</p>}
            {solo && fresh && <p className="m-0 text-sm font-bold text-[#e8707f]">🎉 {tx.new}</p>}
            <div className="flex gap-2">
              {solo && <button onClick={doUndo} className="min-h-11 rounded-full border border-[#dce4d7] bg-white px-4 text-sm font-bold">↩ {tx.undo}</button>}
              <button onClick={restart} className="min-h-11 rounded-full bg-[#246f55] px-4 text-sm font-bold text-white">🔄 {tx.again}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
