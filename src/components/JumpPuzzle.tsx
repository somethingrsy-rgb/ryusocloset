import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { earnStars } from '../lib/shop'
import { playHop, playLand, playLose, playPop, playSetDone, playWin } from '../lib/sound'
import { assetUrl } from '../lib/items'
import { ANIMALS, COLORS, MAX_CPUS, SIZE, STARS_PER_SET, WIN_BONUS, type Move, findMove, isOver, newVs, parseSaved, planCpuTurn, setsOf, vsCpuMove, vsEndTurn, vsHumanMove, vsResult, vsSkipCpu, type Level, type Pos, type Vs } from '../lib/jumpPuzzle'
import { getAvatar } from '../lib/avatars'
import { StarIcon } from './Icons'

const LEVEL_KEY = 'ryuso.jumppuzzle.level.v1'
const LEVELS: Level[] = ['easy', 'normal', 'hard']
const loadLevel = (): Level => { try { const v = localStorage.getItem(LEVEL_KEY); return LEVELS.find((l) => l === v) ?? 'normal' } catch { return 'normal' } }
const CPUS_KEY = 'ryuso.jumppuzzle.cpus.v1'
const loadCpus = () => { try { const n = Number(localStorage.getItem(CPUS_KEY)); return n >= 1 && n <= MAX_CPUS ? Math.floor(n) : 1 } catch { return 1 } }
const STATE_KEY = 'ryuso.jumppuzzle.state.v1' // 하던 판(탭을 옮기거나 닫아도 이어서)
const loadState = () => { try { return parseSaved(JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null')) } catch { return null } }
/** 다섯 색: 빨강·초록·파랑·주황·노랑 (색마다 가운데 무늬가 달라서 색을 구분하기 어려워도 알 수 있다) */
const FILL = ['#ef5a3c', '#7cc545', '#4aa6ea', '#f28c28', '#f8d84a']
const DARK = ['#b8381f', '#4f9526', '#2a78b8', '#b85f0c', '#c2a10c']
const MARK = ['●', '▲', '■', '★', '◆']
// 컴퓨터의 한 수를 슬로 모션으로 보여 준다: 0.5초 쉬고 → 1.4초 동안 말이 날아가 뛰어넘고(잡힌 말은 중간에 사라짐) → 도착하면 0.5초 쉰다
const TURN_GAP_MS = 1100 // 차례가 바뀐 뒤, 동물이 말을 고르기 전에 잠깐 기다림(누구 차례인지 알아보도록)
const CPU_PICK_MS = 900 // 동물이 움직일 말 위에 올라가 있는 시간
const CPU_CHAIN_PICK_MS = 600 // 이어 뛸 때 다음 말을 고르는 시간
const CPU_FLY_MS = 600
const MY_POP_MS = 500
const ME_FLY_MS = 600 // 내 말이 뛰어넘는 시간(동물보다 조금 빠르게)

/** 점프 퍼즐에서 내 얼굴 그림: 류소·유하·유엘만 있고, 소영은 뺐다(소영이면 유하 얼굴) */
const FACES: Record<string, string> = { ryuso: 'face_ryuso', yuha: 'face_yuha', yuel: 'face_yuel' }
const faceSrc = () => assetUrl(`assets/jump/${FACES[getAvatar().id] ?? 'face_yuha'}.webp`)

/** 내 얼굴(작은 표시용). className 으로 크기·자리를 정한다 */
function FaceBadge({ className = '' }: { className?: string }) {
  return <img aria-hidden src={faceSrc()} alt="" draggable={false} className={`inline-block object-contain ${className}`} />
}

const T = {
  ko: {
    title: '점프 퍼즐',
    again: '새 판', close: '닫기', sets: '세트', badMove: '그곳으로는 뛸 수 없어요', over: '더 뛸 수 없어요!',
    level: { easy: '초급', normal: '중급', hard: '고급' },
    you: '나', cpu: '컴퓨터', cpuCount: (n: number) => `${n}마리`, animals: ['토끼', '강아지', '호랑이', '곰돌이', '고양이', '팬더'], myTurn: '내 차례예요', cpuTurn: (name: string) => `${name} 차례예요…`, endTurn: '끝내기',
    win: '이겼어요!', lose: '아쉬워요, 졌어요', draw: '비겼어요', bonus: (c: number) => `이긴 보너스 +${c}`, setStars: (n: number) => `세트 완성! +${n} 별`, setStarsTotal: (n: number) => `세트 별 +${n}`,
  },
  en: {
    title: 'Jump Puzzle',
    again: 'New game', close: 'Close', sets: 'sets', badMove: "You can't jump there", over: 'No more jumps!',
    level: { easy: 'Easy', normal: 'Normal', hard: 'Hard' },
    you: 'You', cpu: 'Computer', cpuCount: (n: number) => `${n}`, animals: ['Bunny', 'Puppy', 'Tiger', 'Teddy', 'Kitty', 'Panda'], myTurn: 'Your turn', cpuTurn: (name: string) => `${name} is thinking…`, endTurn: 'End turn',
    win: 'You win!', lose: 'You lost, try again', draw: "It's a tie", bonus: (c: number) => `Win bonus +${c}`, setStars: (n: number) => `Set complete! +${n} stars`, setStarsTotal: (n: number) => `Set stars +${n}`,
  },
}

export function JumpPuzzle({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n()
  const tx = T[lang]
  const [saved] = useState(loadState)
  const [round, setRound] = useState(0) // 새 판마다 올려서, 첫 차례가 컴퓨터여도 새 판에서 다시 시작되게 한다
  const [cpuCount, setCpuCount] = useState(() => saved?.vs.cpus.length ?? loadCpus())
  const [vs, setVs] = useState<Vs>(() => saved?.vs ?? newVs(Math.random, cpuCount))
  const [level, setLevel] = useState<Level>(loadLevel)
  const [sel, setSel] = useState<Pos | null>(null)
  const [anim, setAnim] = useState<{ m: Move; color: number; who: 'me' | number; flying: boolean; gone: boolean } | null>(null) // 지금 움직이는 말과 그 주인(나 또는 동물 번호): 고르는 중 → 날아가는 중
  const [myPop, setMyPop] = useState(false) // 내 차례가 되면 내 얼굴을 0.5초만 크게 띄운다(돌이 오래 가려지지 않게)
  const [lastMe, setLastMe] = useState<Move | null>(null) // 내가 방금 둔 수(동물이 다음에 두기 전까지 얼굴을 보여 준다)
  const [lastCpu, setLastCpu] = useState<{ m: Move; animal: number } | null>(null) // 동물이 방금 둔 수(내가 다음에 두기 전까지 빛나게 보여 준다)
  const [bonusPaid, setBonusPaid] = useState(saved?.bonusPaid ?? 0)
  const [setsPaid, setSetsPaid] = useState(saved?.setsPaid ?? 0) // 별을 이미 받은 내 세트 수
  const [msg, setMsg] = useState('')
  const timers = useRef<number[]>([])
  useEffect(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify({ vs, bonusPaid, setsPaid })) } catch { /* 저장 실패는 무시 */ }
  }, [vs, bonusPaid, setsPaid])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const say = (t: string) => { setMsg(t); const id = window.setTimeout(() => setMsg(''), 1800); timers.current.push(id) }

  const board = vs.board
  const sets = setsOf(vs.mine)
  const over = isOver(board)
  const result = over ? vsResult(vs) : null

  useEffect(() => {
    if (vs.turn !== 'me' || isOver(vs.board)) { setMyPop(false); return }
    setMyPop(true)
    const id = window.setTimeout(() => setMyPop(false), MY_POP_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vs.turn])

  // 컴퓨터 차례: 정해 둔 수를 하나씩 슬로 모션으로 보여 주며 둔다
  useEffect(() => {
    if (vs.turn === 'me' || isOver(vs.board)) return
    const plan = planCpuTurn(vs.board, vs.cpus[vs.turn], Math.random, level, vs.cpuChain)
    if (plan.length === 0) { setVs(vsSkipCpu); return }
    const ids: number[] = []
    const animal = animalOf(vs.turn)
    let t = TURN_GAP_MS
    let board = vs.board
    plan.forEach((m, i) => {
      const color = board[m.from.r][m.from.c]
      const pick = i === 0 ? CPU_PICK_MS : CPU_CHAIN_PICK_MS
      ids.push(window.setTimeout(() => setAnim({ m, color, who: animal, flying: false, gone: false }), t))
      t += pick
      ids.push(window.setTimeout(() => { playHop(); setAnim((a) => (a ? { ...a, flying: true } : a)) }, t))
      ids.push(window.setTimeout(() => { playPop(); setAnim((a) => (a ? { ...a, gone: true } : a)) }, t + CPU_FLY_MS * 0.5))
      ids.push(window.setTimeout(() => { playLand(); setVs((v) => vsCpuMove(v, m, i === plan.length - 1)); setLastCpu({ m, animal }); setLastMe(null); setAnim(null) }, t + CPU_FLY_MS))
      t += CPU_FLY_MS
      const b2 = board.map((row) => [...row])
      b2[m.to.r][m.to.c] = b2[m.from.r][m.from.c]; b2[m.from.r][m.from.c] = 0; b2[m.over.r][m.over.c] = 0
      board = b2 as typeof board
    })
    return () => { ids.forEach(clearTimeout); setAnim(null) }
    // 한 차례의 수는 처음에 한 번만 정한다(수를 둘 때마다 판이 바뀌어도 다시 정하면 다른 말이 움직인다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vs.turn, level, round])

  // 이기면 별(상점에서 쓸 수 있음). 지거나 비기면 없음
  // 내가 한 세트를 완성할 때마다 별 5개
  useEffect(() => {
    if (sets > setsPaid) { const n = (sets - setsPaid) * STARS_PER_SET; earnStars(n); setSetsPaid(sets); playSetDone(); say(tx.setStars(n)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets])
  useEffect(() => {
    if (result === 'win' && bonusPaid === 0) { earnStars(WIN_BONUS); setBonusPaid(WIN_BONUS); playWin() }
  }, [result, bonusPaid])
  // 졌을 때 부드러운 소리(끝난 판을 다시 열 때는 울리지 않게 이 화면에서 결과가 처음 나올 때만)
  const lastResult = useRef(result)
  useEffect(() => {
    if (result === 'lose' && lastResult.current !== 'lose') playLose()
    lastResult.current = result
  }, [result])
  const tap = (r: number, c: number) => {
    if (over || vs.turn !== 'me' || anim) return
    const v = board[r][c]
    if (v !== 0) {
      if (vs.chain && (vs.chain.r !== r || vs.chain.c !== c)) return // 이어 뛸 때는 방금 뛴 말만
      setSel(sel && sel.r === r && sel.c === c ? null : { r, c })
      return
    }
    if (!sel) return
    const m = findMove(board, sel, { r, c })
    if (!m) { say(tx.badMove); setSel(vs.chain); return }
    // 내 말도 동물처럼 천천히 뛰어넘는다(내 얼굴이 말 위에 올라탄 채로)
    setSel(null)
    setLastCpu(null)
    playHop()
    setAnim({ m, color: board[m.from.r][m.from.c], who: 'me', flying: true, gone: false })
    const next = vsHumanMove(vs, m)
    timers.current.push(
      window.setTimeout(() => { playPop(); setAnim((a) => (a ? { ...a, gone: true } : a)) }, ME_FLY_MS * 0.5),
      window.setTimeout(() => { playLand(); setVs(next); setLastMe(m); setAnim(null); if (next.chain) setSel(next.chain) }, ME_FLY_MS),
    )
  }
  const endTurn = () => { setVs((v) => vsEndTurn(v)); setSel(null) }
  const restart = (count = cpuCount) => { setRound((r) => r + 1); setVs(newVs(Math.random, count)); setSel(null); setLastCpu(null); setLastMe(null); setBonusPaid(0); setSetsPaid(0); setMsg('') }
  const pickLevel = (l: Level) => { setLevel(l); try { localStorage.setItem(LEVEL_KEY, l) } catch { /* 저장 실패는 무시 */ } }
  const pickCpus = (n: number) => { if (n === cpuCount) return; setCpuCount(n); try { localStorage.setItem(CPUS_KEY, String(n)) } catch { /* 저장 실패는 무시 */ } restart(n) }
  const animalOf = (i: number) => vs.animals[i] ?? i
  const cpuName = (i: number) => tx.animals[animalOf(i)]
  const animalSrc = (i: number) => assetUrl(`assets/jump/${ANIMALS[animalOf(i)]}.webp`)

  const turnText = typeof vs.turn === 'number' ? tx.cpuTurn(cpuName(vs.turn)) : tx.myTurn // 화면 읽기용(위 큰 표시는 aria-hidden)

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl bg-[#faf9f2] text-[#213f35] ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2 border-b border-[#e2e7dc] px-4 py-2">
        <h2 className="m-0 text-xl font-normal [font-family:Jua,'Noto_Sans_KR',sans-serif]">🔴 {tx.title}</h2>
        <button onClick={onClose} aria-label={tx.close} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dce4d7] bg-white text-xl text-[#246f55]">✕</button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-2 overflow-hidden px-3 py-2 landscape:grid landscape:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)] landscape:grid-rows-[auto_minmax(0,1fr)] landscape:items-start landscape:gap-x-4">
        <div className="flex w-full flex-col items-center gap-2 landscape:col-start-2 landscape:row-start-1">
        {(
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
        <div className="flex w-full max-w-[44rem] landscape:max-w-none flex-col gap-1.5 rounded-2xl bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex w-[4.6rem] shrink-0 items-center gap-1 text-xs font-bold text-[#678071]"><FaceBadge className="h-6" />{tx.you}</span>
            <div className="flex flex-1 gap-1" aria-label="pocket">
              {Array.from({ length: COLORS }, (_, i) => (
                <span key={i} className="flex items-center gap-0.5 rounded-full px-1 py-0.5 text-xs font-bold text-white" style={{ background: FILL[i] }}><span aria-hidden>{MARK[i]}</span>{vs.mine[i]}</span>
              ))}
            </div>
            <div className="shrink-0 whitespace-nowrap text-right text-xs leading-tight font-bold"><div className="text-base text-[#246f55]">{sets} {tx.sets}</div></div>
          </div>
          {vs.cpus.map((pocket, ci) => (
            <div key={ci} className={`flex items-center justify-between gap-2 ${vs.turn === ci ? 'font-extrabold' : ''}`}>
              <span className="flex w-[4.6rem] shrink-0 items-center gap-1 whitespace-nowrap text-xs font-bold text-[#678071]"><img src={animalSrc(ci)} alt="" draggable={false} className="h-6 w-6 object-contain" />{cpuName(ci)}</span>
              <div className="flex flex-1 gap-1" aria-label={`computer ${ci + 1} pocket`}>
                {Array.from({ length: COLORS }, (_, i) => (
                  <span key={i} className="flex items-center gap-0.5 rounded-full px-1 py-0.5 text-xs font-bold text-white" style={{ background: FILL[i] }}><span aria-hidden>{MARK[i]}</span>{pocket[i]}</span>
                ))}
              </div>
              <div className="shrink-0 whitespace-nowrap text-right text-base font-bold text-[#246f55]">{setsOf(pocket)} {tx.sets}</div>
            </div>
          ))}
        </div>
        </div>

        <div className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center landscape:col-start-1 landscape:row-span-2 landscape:row-start-1 landscape:h-full" style={{ containerType: 'size' }}>
        <div role="grid" aria-label={tx.title} className={`relative grid aspect-square gap-[3px] rounded-2xl bg-[#d9e3cf] p-1.5 transition-shadow ${!over && vs.turn === 'me' ? 'shadow-[0_0_0_4px_#7cc545,0_0_22px_6px_rgba(124,197,69,.55)]' : ''}`} style={{ width: 'min(100cqw, 100cqh)', gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))` }}>
          {board.flatMap((row, r) => row.map((v, c) => {
            const picked = sel && sel.r === r && sel.c === c
            const hidden = anim && ((anim.m.from.r === r && anim.m.from.c === c) || (anim.gone && anim.m.over.r === r && anim.m.over.c === c))
            const cv = hidden ? 0 : v
            const landed = vs.turn !== 'me' && lastCpu && lastCpu.m.to.r === r && lastCpu.m.to.c === c
            return (
              <button
                key={`${r}-${c}`}
                role="gridcell"
                aria-label={cv ? `${r + 1}-${c + 1} ${MARK[cv - 1]}` : `${r + 1}-${c + 1}`}
                onClick={() => tap(r, c)}
                className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border-0 p-[8%] ${v === 0 ? 'bg-[#eef3e6]' : 'bg-[#f6f9f0]'}`}
              >
                {cv !== 0 && (
                  <span
                    className={`flex h-full w-full items-center justify-center rounded-full text-[min(3.2vw,1.1rem)] font-black text-white/80 shadow-[inset_0_-3px_0_rgba(0,0,0,.18)] transition ${picked ? 'scale-110 ring-4 ring-[#213f35]' : ''}`}
                    style={{ background: FILL[cv - 1], border: `2px solid ${DARK[cv - 1]}` }}
                  >{MARK[cv - 1]}</span>
                )}
                {vs.turn !== 'me' && lastMe && lastMe.to.r === r && lastMe.to.c === c && !lastCpu && !anim && <span className="pointer-events-none absolute -top-1 -right-1 z-[1] w-[95%] drop-shadow"><FaceBadge className="w-full" /></span>}
                {landed && !anim && <img src={assetUrl(`assets/jump/${ANIMALS[lastCpu.animal]}.webp`)} alt="" draggable={false} className="pointer-events-none absolute -top-0.5 -right-0.5 z-[1] w-[62%] object-contain drop-shadow" />}
              </button>
            )
          }))}
          {anim && (
            <div aria-hidden className="pointer-events-none absolute inset-1.5 z-10">
              <div
                className={`${anim.flying ? 'jump-fly ' : ''}absolute aspect-square`}
                style={{
                  left: `calc(${anim.m.from.c} * (100% + 3px) / ${SIZE})`, top: `calc(${anim.m.from.r} * (100% + 3px) / ${SIZE})`, width: `calc((100% - ${(SIZE - 1) * 3}px) / ${SIZE})`,
                  ['--tx' as string]: `calc(${anim.m.to.c - anim.m.from.c} * (100% + 3px))`, ['--ty' as string]: `calc(${anim.m.to.r - anim.m.from.r} * (100% + 3px))`,
                  ['--mx' as string]: `calc(${(anim.m.to.c - anim.m.from.c) / 2} * (100% + 3px))`, ['--my' as string]: `calc(${(anim.m.to.r - anim.m.from.r) / 2} * (100% + 3px))`,
                  animationDuration: `${anim.who === 'me' ? ME_FLY_MS : CPU_FLY_MS}ms`,
                } as React.CSSProperties}
              >
                <span className="absolute inset-[8%] flex items-center justify-center rounded-full text-[min(3.2vw,1.1rem)] font-black text-white/80 shadow-[inset_0_-3px_0_rgba(0,0,0,.18),0_6px_10px_rgba(0,0,0,.3)]" style={{ background: FILL[anim.color - 1], border: `2px solid ${DARK[anim.color - 1]}` }}>{MARK[anim.color - 1]}</span>
                <img src={anim.who === 'me' ? faceSrc() : assetUrl(`assets/jump/${ANIMALS[anim.who]}.webp`)} alt="" draggable={false} className={`absolute -top-[62%] left-1/2 w-[120%] -translate-x-1/2 object-contain drop-shadow-md ${anim.flying ? '' : 'animate-bounce'}`} />
              </div>
            </div>
          )}
          {myPop && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <img src={faceSrc()} alt="" draggable={false} className="jump-pop w-[46%] object-contain drop-shadow-xl" />
            </div>
          )}
          {sel && !anim && vs.turn === 'me' && !over && (
            <div aria-hidden className="pointer-events-none absolute inset-1.5 z-10">
              <div className="absolute aspect-square" style={{ left: `calc(${sel.c} * (100% + 3px) / ${SIZE})`, top: `calc(${sel.r} * (100% + 3px) / ${SIZE})`, width: `calc((100% - ${(SIZE - 1) * 3}px) / ${SIZE})` }}>
                <img src={faceSrc()} alt="" draggable={false} className="absolute -top-[62%] left-1/2 w-[120%] -translate-x-1/2 animate-bounce object-contain drop-shadow-md" />
              </div>
            </div>
          )}
        </div>
        </div>

        <div className="flex w-full flex-col items-center gap-2 landscape:col-start-2 landscape:row-start-2 landscape:self-start">

        <p className={`m-0 min-h-5 text-center text-sm font-bold text-[#246f55] ${!msg ? 'sr-only' : ''}`} role="status" aria-live="polite">{msg || turnText}</p>
        {!over && (
          <p
            className={`m-0 rounded-full px-4 py-1 text-center text-sm font-extrabold ${vs.turn === 'me' ? 'bg-white text-[#246f55] shadow-[0_0_0_2px_#7cc545,0_0_12px_3px_rgba(124,197,69,.5)]' : 'bg-[#eef0e8] text-[#678071]'}`}
            aria-hidden
          >{typeof vs.turn === 'number' ? <><img src={animalSrc(vs.turn)} alt="" draggable={false} className="mr-1 inline-block h-5 w-5 object-contain align-text-bottom" />{tx.cpuTurn(cpuName(vs.turn))}</> : <><FaceBadge className="mr-1 h-5 align-text-bottom" />{tx.myTurn}</>}</p>
        )}

        <div className="flex gap-2">
          <button onClick={endTurn} disabled={!vs.chain || vs.turn !== 'me'} className="min-h-9 rounded-full border border-[#dce4d7] bg-white px-4 text-xs font-bold disabled:opacity-40">✋ {tx.endTurn}</button>
          <button onClick={() => restart()} className="min-h-9 rounded-full bg-[#246f55] px-4 text-xs font-bold text-white">🔄 {tx.again}</button>
        </div>
        </div>
      </div>

      {over && (
        <div role="dialog" aria-label={tx.over} className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-6">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="m-0 text-lg font-extrabold">{result ? tx[result] : tx.over}</p>
            <p className="m-0 text-3xl font-extrabold text-[#246f55]">{[sets, ...vs.cpus.map(setsOf)].join(' : ')}</p>
            {setsPaid * STARS_PER_SET + bonusPaid > 0 && (
              <div className="jump-reward flex w-full flex-col items-center gap-1 rounded-3xl bg-gradient-to-b from-[#fff3c4] to-[#ffd96b] px-4 py-4 shadow-[0_0_0_4px_#f5a623,0_0_26px_8px_rgba(245,166,35,.55)]">
                <span className="animate-bounce text-[5rem] leading-none drop-shadow-lg"><StarIcon /></span>
                <p className="m-0 text-6xl leading-none font-black text-[#b8610a] [text-shadow:0_3px_0_#fff]">+{setsPaid * STARS_PER_SET + bonusPaid}</p>
                <div className="mt-1 flex flex-col items-center text-sm font-bold text-[#8a5a12]">
                  {setsPaid > 0 && <span>{tx.setStarsTotal(setsPaid * STARS_PER_SET)}</span>}
                  {bonusPaid > 0 && <span>{tx.bonus(bonusPaid)}</span>}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => restart()} className="min-h-11 rounded-full bg-[#246f55] px-4 text-sm font-bold text-white">🔄 {tx.again}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
