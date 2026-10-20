import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { actFarm } from '../lib/farm'
import { earnStars } from '../lib/shop'
import { assetUrl } from '../lib/items'
import { COINS_PER_SET, COLORS, MAX_CPUS, SIZE, WIN_BONUS, applyMove, type Move, findMove, isOver, newGame, newVs, parseSaved, planCpuTurn, setsOf, undo, vsCpuMove, vsEndTurn, vsSkipCpu, vsHumanMove, vsResult, type Game, type Level, type Pos, type Vs } from '../lib/jumpPuzzle'
import { CoinIcon, StarIcon } from './Icons'

const KEY = 'ryuso.jumppuzzle.v1'
const LEVEL_KEY = 'ryuso.jumppuzzle.level.v1'
const LEVELS: Level[] = ['easy', 'normal', 'hard']
const loadLevel = (): Level => { try { const v = localStorage.getItem(LEVEL_KEY); return LEVELS.find((l) => l === v) ?? 'normal' } catch { return 'normal' } }
const CPUS_KEY = 'ryuso.jumppuzzle.cpus.v1'
const loadCpus = () => { try { const n = Number(localStorage.getItem(CPUS_KEY)); return n >= 1 && n <= MAX_CPUS ? Math.floor(n) : 1 } catch { return 1 } }
const STATE_KEY = 'ryuso.jumppuzzle.state.v1' // 하던 판(탭을 옮기거나 닫아도 이어서)
const loadState = () => { try { return parseSaved(JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null')) } catch { return null } }
const loadBest = () => { try { const n = Number(localStorage.getItem(KEY)); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0 } catch { return 0 } }
/** 네 색: 빨강·초록·파랑·주황 (색마다 가운데 무늬가 달라서 색을 구분하기 어려워도 알 수 있다) */
const FILL = ['#ef5a3c', '#7cc545', '#4aa6ea', '#f5a623']
const DARK = ['#b8381f', '#4f9526', '#2a78b8', '#c27d0c']
const MARK = ['●', '▲', '■', '★']
// 컴퓨터의 한 수를 슬로 모션으로 보여 준다: 0.5초 쉬고 → 1.4초 동안 말이 날아가 뛰어넘고(잡힌 말은 중간에 사라짐) → 도착하면 0.5초 쉰다
const CPU_PAUSE_MS = 500
const CPU_FLY_MS = 1400

const T = {
  ko: {
    title: '점프 퍼즐', how: '말을 눌러 고른 뒤, 이웃한 말을 뛰어넘어 빈칸을 눌러요. 뛰어넘은 말은 내 것이 돼요. 네 색을 하나씩 모으면 한 세트!',
    howVs: '내 차례에 말을 뛰어넘어 모아요. 이어서 더 뛸 수 있으면 계속하거나 끝내기를 눌러요. 컴퓨터보다 세트를 많이 모으면 이겨요!',
    undo: '되돌리기', again: '새 판', close: '닫기', sets: '세트', best: '최고 기록', badMove: '그곳으로는 뛸 수 없어요', over: '더 뛸 수 없어요!',
    result: (n: number) => `${n}세트 완성!`, got: (c: number) => `+${c} 코인`, new: '새 기록!',
    level: { easy: '초급', normal: '중급', hard: '고급' },
    solo: '혼자', vs: '컴퓨터와', you: '나', cpu: '컴퓨터', cpuCount: (n: number) => `${n}대`, myTurn: '내 차례예요', cpuTurn: (n: number, multi: boolean) => (multi ? `컴퓨터 ${n} 차례예요…` : '컴퓨터 차례예요…'), endTurn: '끝내기',
    win: '이겼어요!', lose: '아쉬워요, 졌어요', draw: '비겼어요', bonus: (c: number) => `이긴 보너스 +${c}`,
  },
  en: {
    title: 'Jump Puzzle', how: 'Tap a piece, then tap an empty spot beyond a neighbor to jump it and keep it. Collect one of each color for a set!',
    howVs: 'On your turn, jump and collect pieces. If you can jump again, keep going or end your turn. Beat the computer with more sets!',
    undo: 'Undo', again: 'New game', close: 'Close', sets: 'sets', best: 'Best', badMove: "You can't jump there", over: 'No more jumps!',
    result: (n: number) => `${n} sets!`, got: (c: number) => `+${c} coins`, new: 'New best!',
    level: { easy: 'Easy', normal: 'Normal', hard: 'Hard' },
    solo: 'Solo', vs: 'Vs computer', you: 'You', cpu: 'Computer', cpuCount: (n: number) => `${n} CPU`, myTurn: 'Your turn', cpuTurn: (n: number, multi: boolean) => (multi ? `Computer ${n} is thinking…` : 'Computer is thinking…'), endTurn: 'End turn',
    win: 'You win!', lose: 'You lost, try again', draw: "It's a tie", bonus: (c: number) => `Win bonus +${c}`,
  },
}

export function JumpPuzzle({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n()
  const tx = T[lang]
  const [saved] = useState(loadState)
  const [mode, setMode] = useState<'solo' | 'vs'>(saved?.mode ?? 'solo')
  const [game, setGame] = useState<Game>(() => saved?.game ?? newGame())
  const [cpuCount, setCpuCount] = useState(() => saved?.vs.cpus.length ?? loadCpus())
  const [vs, setVs] = useState<Vs>(() => saved?.vs ?? newVs(Math.random, cpuCount))
  const [level, setLevel] = useState<Level>(loadLevel)
  const [sel, setSel] = useState<Pos | null>(null)
  const [anim, setAnim] = useState<{ m: Move; color: number; gone: boolean } | null>(null) // 지금 날아가는 컴퓨터의 말
  const [lastCpu, setLastCpu] = useState<Move | null>(null) // 컴퓨터가 방금 둔 수(내가 다음에 두기 전까지 빛나게 보여 준다)
  const [paid, setPaid] = useState(saved?.paid ?? 0) // 이 판에서 코인을 이미 받은 세트 수 (되돌렸다 다시 해도 같은 세트는 한 번만)
  const [bonusPaid, setBonusPaid] = useState(saved?.bonusPaid ?? 0)
  const [best, setBest] = useState(loadBest)
  const [msg, setMsg] = useState('')
  const [fresh, setFresh] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify({ mode, game, vs, paid, bonusPaid })) } catch { /* 저장 실패는 무시 */ }
  }, [mode, game, vs, paid, bonusPaid])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const say = (t: string) => { setMsg(t); const id = window.setTimeout(() => setMsg(''), 1800); timers.current.push(id) }

  const solo = mode === 'solo'
  const board = solo ? game.board : vs.board
  const mine = solo ? game.pocket : vs.mine
  const sets = setsOf(mine)
  const over = isOver(board)
  const result = !solo && over ? vsResult(vs) : null

  // 컴퓨터 차례: 정해 둔 수를 하나씩 슬로 모션으로 보여 주며 둔다
  useEffect(() => {
    if (solo || vs.turn === 'me' || isOver(vs.board)) return
    const plan = planCpuTurn(vs.board, vs.cpus[vs.turn], Math.random, level, vs.cpuChain)
    if (plan.length === 0) { setVs(vsSkipCpu); return }
    const ids: number[] = []
    let t = CPU_PAUSE_MS
    let board = vs.board
    plan.forEach((m, i) => {
      const color = board[m.from.r][m.from.c]
      ids.push(window.setTimeout(() => setAnim({ m, color, gone: false }), t))
      ids.push(window.setTimeout(() => setAnim((a) => (a ? { ...a, gone: true } : a)), t + CPU_FLY_MS * 0.5))
      ids.push(window.setTimeout(() => { setVs((v) => vsCpuMove(v, m, i === plan.length - 1)); setLastCpu(m); setAnim(null) }, t + CPU_FLY_MS))
      t += CPU_FLY_MS + CPU_PAUSE_MS
      const b2 = board.map((row) => [...row])
      b2[m.to.r][m.to.c] = b2[m.from.r][m.from.c]; b2[m.from.r][m.from.c] = 0; b2[m.over.r][m.over.c] = 0
      board = b2 as typeof board
    })
    return () => { ids.forEach(clearTimeout); setAnim(null) }
    // 한 차례의 수는 처음에 한 번만 정한다(수를 둘 때마다 판이 바뀌어도 다시 정하면 다른 말이 움직인다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solo, vs.turn, level])

  // 코인: 혼자 할 때는 세트를 새로 모았을 때(되돌린 세트는 다시 주지 않음), 컴퓨터와는 이겼을 때만 보너스
  useEffect(() => {
    if (solo && sets > paid) { actFarm({ type: 'earn', amount: (sets - paid) * COINS_PER_SET }); setPaid(sets); say(tx.got((sets - paid) * COINS_PER_SET)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets])
  useEffect(() => {
    if (result === 'win' && bonusPaid === 0) { earnStars(WIN_BONUS); setBonusPaid(WIN_BONUS) }
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
    setLastCpu(null)
    if (solo) setGame((g) => applyMove(g, m))
    else {
      const next = vsHumanMove(vs, m)
      setVs(next)
      if (next.chain) setSel(next.chain)
    }
  }
  const doUndo = () => { setGame((g) => undo(g)); setSel(null); setFresh(false) }
  const endTurn = () => { setVs((v) => vsEndTurn(v)); setSel(null) }
  const restart = (count = cpuCount) => { setGame(newGame()); setVs(newVs(Math.random, count)); setSel(null); setLastCpu(null); setPaid(0); setBonusPaid(0); setFresh(false); setMsg('') }
  const pickLevel = (l: Level) => { setLevel(l); try { localStorage.setItem(LEVEL_KEY, l) } catch { /* 저장 실패는 무시 */ } }
  const pickCpus = (n: number) => { if (n === cpuCount) return; setCpuCount(n); try { localStorage.setItem(CPUS_KEY, String(n)) } catch { /* 저장 실패는 무시 */ } restart(n) }
  const cpuName = (i: number) => (cpuCount > 1 ? `${tx.cpu} ${i + 1}` : tx.cpu)
  const switchMode = (m: 'solo' | 'vs') => { if (m !== mode) { setMode(m); restart() } }

  const turnText = solo ? '' : typeof vs.turn === 'number' ? tx.cpuTurn(vs.turn + 1, cpuCount > 1) : tx.myTurn // 화면 읽기용(위 큰 표시는 aria-hidden)
  const total = paid * COINS_PER_SET // 코인(혼자 하기의 세트 보상)

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
        {!solo && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <div role="radiogroup" aria-label="level" className="flex rounded-full bg-[#e8efdc] p-0.5 text-xs font-bold">
              {LEVELS.map((l) => (
                <button key={l} role="radio" aria-checked={level === l} onClick={() => pickLevel(l)} className={`min-h-8 rounded-full border-0 px-3 ${level === l ? 'bg-[#246f55] text-white' : 'bg-transparent text-[#246f55]'}`}>{tx.level[l]}</button>
              ))}
            </div>
            <div role="radiogroup" aria-label="computers" className="flex rounded-full bg-[#e8efdc] p-0.5 text-xs font-bold">
              {Array.from({ length: MAX_CPUS }, (_, i) => i + 1).map((n) => (
                <button key={n} role="radio" aria-checked={cpuCount === n} onClick={() => pickCpus(n)} className={`min-h-8 rounded-full border-0 px-3 ${cpuCount === n ? 'bg-[#246f55] text-white' : 'bg-transparent text-[#246f55]'}`}>{tx.cpuCount(n)}</button>
              ))}
            </div>
          </div>
        )}
        <div className="flex w-full max-w-[34rem] flex-col gap-1.5 rounded-2xl bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="w-[4.6rem] shrink-0 text-xs font-bold text-[#678071]">{tx.you}</span>
            <div className="flex flex-1 gap-1" aria-label="pocket">
              {Array.from({ length: COLORS }, (_, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-sm font-bold text-white" style={{ background: FILL[i] }}><span aria-hidden>{MARK[i]}</span>{mine[i]}</span>
              ))}
            </div>
            <div className="shrink-0 whitespace-nowrap text-right text-xs leading-tight font-bold"><div className="text-base text-[#246f55]">{sets} {tx.sets}</div>{solo && <div className="text-[#678071]">{tx.best} {best}</div>}</div>
          </div>
          {!solo && vs.cpus.map((pocket, ci) => (
            <div key={ci} className={`flex items-center justify-between gap-2 ${vs.turn === ci ? 'font-extrabold' : ''}`}>
              <span className="flex w-[4.6rem] shrink-0 items-center gap-1 whitespace-nowrap text-xs font-bold text-[#678071]"><img src={assetUrl('assets/tabs/bunny.webp')} alt="" draggable={false} className="h-5 w-5 object-contain" />{cpuName(ci)}</span>
              <div className="flex flex-1 gap-1" aria-label={`computer ${ci + 1} pocket`}>
                {Array.from({ length: COLORS }, (_, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-sm font-bold text-white" style={{ background: FILL[i] }}><span aria-hidden>{MARK[i]}</span>{pocket[i]}</span>
                ))}
              </div>
              <div className="shrink-0 whitespace-nowrap text-right text-base font-bold text-[#246f55]">{setsOf(pocket)} {tx.sets}</div>
            </div>
          ))}
        </div>

        <div role="grid" aria-label={tx.title} className={`relative grid aspect-square w-full gap-[3px] rounded-2xl bg-[#d9e3cf] p-1.5 transition-shadow ${!solo && !over && vs.turn === 'me' ? 'shadow-[0_0_0_4px_#7cc545,0_0_22px_6px_rgba(124,197,69,.55)]' : ''}`} style={{ maxWidth: `min(34rem, calc(100dvh - ${solo ? 24 : 24 + (cpuCount - 1) * 2.3}rem))`, gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))` }}>
          {board.flatMap((row, r) => row.map((v, c) => {
            const picked = sel && sel.r === r && sel.c === c
            const hidden = anim && ((anim.m.from.r === r && anim.m.from.c === c) || (anim.gone && anim.m.over.r === r && anim.m.over.c === c))
            const cv = hidden ? 0 : v
            const landed = !solo && lastCpu && lastCpu.to.r === r && lastCpu.to.c === c
            const left = !solo && lastCpu && ((lastCpu.from.r === r && lastCpu.from.c === c) || (lastCpu.over.r === r && lastCpu.over.c === c))
            return (
              <button
                key={`${r}-${c}`}
                role="gridcell"
                aria-label={cv ? `${r + 1}-${c + 1} ${MARK[cv - 1]}` : `${r + 1}-${c + 1}`}
                onClick={() => tap(r, c)}
                className={`flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border-0 p-[8%] ${landed && !anim ? 'bg-[#fff6d6] shadow-[0_0_0_3px_#f5a623,0_0_14px_4px_rgba(245,166,35,.6)]' : left ? 'bg-[#fff6d6]/70 shadow-[inset_0_0_0_2px_#f5c36b]' : v === 0 ? 'bg-[#eef3e6]' : 'bg-[#f6f9f0]'}`}
              >
                {cv !== 0 && (
                  <span
                    className={`flex h-full w-full items-center justify-center rounded-full text-[min(3.2vw,1.1rem)] font-black text-white/80 shadow-[inset_0_-3px_0_rgba(0,0,0,.18)] transition ${picked ? 'scale-110 ring-4 ring-[#213f35]' : ''}`}
                    style={{ background: FILL[cv - 1], border: `2px solid ${DARK[cv - 1]}` }}
                  >{MARK[cv - 1]}</span>
                )}
              </button>
            )
          }))}
          {anim && (
            <div aria-hidden className="pointer-events-none absolute inset-1.5 z-10">
              <div
                className="jump-fly absolute aspect-square"
                style={{
                  left: `calc(${anim.m.from.c} * (100% + 3px) / ${SIZE})`, top: `calc(${anim.m.from.r} * (100% + 3px) / ${SIZE})`, width: `calc((100% - ${(SIZE - 1) * 3}px) / ${SIZE})`,
                  ['--tx' as string]: `calc(${anim.m.to.c - anim.m.from.c} * (100% + 3px))`, ['--ty' as string]: `calc(${anim.m.to.r - anim.m.from.r} * (100% + 3px))`,
                  ['--mx' as string]: `calc(${(anim.m.to.c - anim.m.from.c) / 2} * (100% + 3px))`, ['--my' as string]: `calc(${(anim.m.to.r - anim.m.from.r) / 2} * (100% + 3px))`,
                  animationDuration: `${CPU_FLY_MS}ms`,
                } as React.CSSProperties}
              >
                <span className="absolute inset-[8%] flex items-center justify-center rounded-full text-[min(3.2vw,1.1rem)] font-black text-white/80 shadow-[inset_0_-3px_0_rgba(0,0,0,.18),0_6px_10px_rgba(0,0,0,.3)]" style={{ background: FILL[anim.color - 1], border: `2px solid ${DARK[anim.color - 1]}` }}>{MARK[anim.color - 1]}</span>
              </div>
            </div>
          )}
        </div>

        <p className={`m-0 min-h-5 text-center text-sm font-bold text-[#246f55] ${!solo && !msg ? 'sr-only' : ''}`} role="status" aria-live="polite">{msg || turnText}</p>
        {!solo && !over && (
          <p
            className={`m-0 rounded-full px-4 py-1 text-center text-sm font-extrabold ${vs.turn === 'me' ? 'bg-white text-[#246f55] shadow-[0_0_0_2px_#7cc545,0_0_12px_3px_rgba(124,197,69,.5)]' : 'bg-[#eef0e8] text-[#678071]'}`}
            aria-hidden
          >{typeof vs.turn === 'number' ? tx.cpuTurn(vs.turn + 1, cpuCount > 1) : tx.myTurn}</p>
        )}
        {(solo ? game.history.length === 0 : vs.mine.every((n) => n === 0) && vs.turn === 'me') && !msg && <p className="m-0 max-w-[34rem] text-center text-xs leading-relaxed text-[#678071]">{solo ? tx.how : tx.howVs}</p>}

        <div className="flex gap-2">
          {solo
            ? <button onClick={doUndo} disabled={game.history.length === 0} className="min-h-9 rounded-full border border-[#dce4d7] bg-white px-4 text-xs font-bold disabled:opacity-40">↩ {tx.undo}</button>
            : <button onClick={endTurn} disabled={!vs.chain || vs.turn !== 'me'} className="min-h-9 rounded-full border border-[#dce4d7] bg-white px-4 text-xs font-bold disabled:opacity-40">✋ {tx.endTurn}</button>}
          <button onClick={() => restart()} className="min-h-9 rounded-full bg-[#246f55] px-4 text-xs font-bold text-white">🔄 {tx.again}</button>
        </div>
      </div>

      {over && (
        <div role="dialog" aria-label={tx.over} className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-6">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="m-0 text-lg font-extrabold">{result ? tx[result] : tx.over}</p>
            <p className="m-0 text-3xl font-extrabold text-[#246f55]">{result ? [sets, ...vs.cpus.map(setsOf)].join(' : ') : tx.result(sets)}</p>
            {total > 0 && <p className="m-0 flex items-center gap-1 text-sm font-bold text-[#c9751f]">{tx.got(total)} <CoinIcon /></p>}
            {bonusPaid > 0 && <p className="m-0 flex items-center gap-1 text-sm font-bold text-[#c9751f]">{tx.bonus(bonusPaid)} <StarIcon /></p>}
            {solo && fresh && <p className="m-0 text-sm font-bold text-[#e8707f]">🎉 {tx.new}</p>}
            <div className="flex gap-2">
              {solo && <button onClick={doUndo} className="min-h-11 rounded-full border border-[#dce4d7] bg-white px-4 text-sm font-bold">↩ {tx.undo}</button>}
              <button onClick={() => restart()} className="min-h-11 rounded-full bg-[#246f55] px-4 text-sm font-bold text-white">🔄 {tx.again}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
