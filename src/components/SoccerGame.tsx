import { useEffect, useRef, useState } from 'react'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { AVATARS, baseFiles, getHairstyle, hairZ } from '../lib/avatars'
import { assetUrl } from '../lib/items'
import { FH, FW, GOAL_BOT, GOAL_TOP, MATCH_SECONDS, newMatch, splitAnimals, stepMatch, type Match, type Team, type Vec } from '../lib/soccer'
import { playHop, playLevelDone, playTap, playWin, startBgm, stopBgm } from '../lib/sound'
import { AvatarHead } from './AvatarHead'

/** 팀 색: 빨강 팀 축구복(유하 몸에 맞춰 그림), 보라 팀 축구복(유엘 몸에 맞춰 그림) */
const KIT: Record<Team, { costume: string; shoes: string; color: string; soft: string; name: string }> = {
  0: { costume: 'costume_soccer_red', shoes: 'shoes_soccer_red', color: '#e2475b', soft: '#ffe1e5', name: '빨강' },
  1: { costume: 'costume_soccer_purple', shoes: 'shoes_soccer_purple', color: '#9a7be0', soft: '#efe8ff', name: '보라' },
}
const avatarById = (id: string) => AVATARS.find((a) => a.id === id) ?? AVATARS[0]

/** 축구복과 축구화를 입은 아바타(지금 고른 아바타와 상관없이 그 아바타의 몸·머리로) */
function KitFigure({ id, team }: { id: string; team: Team }) {
  const a = avatarById(id)
  const f = baseFiles(a, getHairstyle(a))
  return (
    <>
      <img src={assetUrl(f.bodyBarefoot)} alt="" className="layer" style={{ zIndex: 0 }} draggable={false} />
      <img src={assetUrl(`assets/clothes/shoes/${KIT[team].shoes}.webp`)} alt="" className="layer" style={{ zIndex: 10 }} draggable={false} />
      <img src={assetUrl(`assets/clothes/costume/${KIT[team].costume}.webp`)} alt="" className="layer" style={{ zIndex: 41 }} draggable={false} />
      <img src={assetUrl(f.hairFront)} alt="" className="layer" style={{ zIndex: hairZ(a) }} draggable={false} />
    </>
  )
}

/**
 * 축구: 아바타 2명(두 사람이 한 화면에서 한 명씩 움직임) + 동물 친구 8마리를 4마리씩 나눠 빨강 팀·보라 팀.
 * 자기 편 쪽 화면을 누르고 끌면 아바타가 손가락을 따라 달리고, 공에 닿으면 저절로 상대 골대 쪽으로 찬다. 2분 경기.
 * 세로 화면은 경기장을 세워서(빨강 팀이 아래에서 위로 공격) 그린다.
 */
export function SoccerGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup')
  const [avatars, setAvatars] = useState<[string, string]>(['yuha', 'yuel'])
  /** 1인: 빨강 팀만 사람이 하고 보라 팀 아바타는 컴퓨터가, 2인: 두 사람이 한 팀씩 */
  const [players, setPlayers] = useState<1 | 2>(() => { try { return localStorage.getItem('ryuso.soccer.players') === '2' ? 2 : 1 } catch { return 1 } })
  const [animals, setAnimals] = useState<[number[], number[]]>([[0, 1, 2, 3], [4, 5, 6, 7]])
  const [match, setMatch] = useState<Match>(() => newMatch(avatars, animals))
  const [goal, setGoal] = useState<Team | null>(null)
  const [golden, setGolden] = useState(false) // 비겨서 골든골 시작 안내
  const live = useRef(match)
  const targets = useRef<[Vec | null, Vec | null]>([null, null])
  const pointers = useRef(new Map<number, Team>())
  const keys = useRef(new Set<string>())
  const host = useRef<HTMLElement>(null)
  const [size, setSize] = useState({ w: 390, h: 700 })
  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { if (phase !== 'play') return; startBgm('run'); return stopBgm }, [phase])

  // 경기장 자리: 세로 화면은 세워서(가로 60 × 세로 100), 가로 화면은 눕혀서. 위 점수판 자리(52px)를 비운다
  const portrait = size.h > size.w
  const top = 52, pad = 10
  const availW = size.w - pad * 2, availH = size.h - top - pad
  const scale = portrait ? Math.min(availW / (FH + 4), availH / (FW + 16)) : Math.min(availW / (FW + 16), availH / (FH + 4)) // 골대(3.5)와 그 옆 팀 이름 자리까지 비운다
  const fw = (portrait ? FH : FW) * scale, fh = (portrait ? FW : FH) * scale
  const left = (size.w - fw) / 2, fieldTop = top + (availH - fh) / 2
  const toScreen = (x: number, y: number) => (portrait ? { x: left + (y / FH) * fw, y: fieldTop + (1 - x / FW) * fh } : { x: left + (x / FW) * fw, y: fieldTop + (y / FH) * fh })
  const toField = (sx: number, sy: number): Vec => (portrait ? { x: (1 - (sy - fieldTop) / fh) * FW, y: ((sx - left) / fw) * FH } : { x: ((sx - left) / fw) * FW, y: ((sy - fieldTop) / fh) * FH })
  /** 경기장 좌표의 네모를 화면 네모로 */
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    const a = toScreen(x0, y0), b = toScreen(x1, y1)
    return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
  }

  // 경기 진행
  useEffect(() => {
    if (phase !== 'play') return
    let frame = 0, last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      // 키보드: 빨강 WASD, 보라 방향키(누르는 쪽으로 계속 달린다)
      const k = keys.current
      const kb = (team: Team, up: string, down: string, lft: string, rgt: string): Vec | null => {
        const dx = (k.has(rgt) ? 1 : 0) - (k.has(lft) ? 1 : 0), dy = (k.has(down) ? 1 : 0) - (k.has(up) ? 1 : 0)
        if (!dx && !dy) return null
        const p = live.current.players.find((q) => q.team === team && q.role === 'human')!
        return { x: p.x + dx * 10, y: p.y + dy * 10 }
      }
      const t: [Vec | null, Vec | null] = [targets.current[0] ?? kb(0, 'w', 's', 'a', 'd'), targets.current[1] ?? kb(1, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')]
      const r = stepMatch(live.current, dt, t)
      live.current = r.m
      setMatch(r.m)
      if (r.events.includes('kick')) playHop()
      const g = r.events.find((e) => e.startsWith('goal'))
      if (g) { playWin(); const team = Number(g[4]) as Team; setGoal(team); window.setTimeout(() => setGoal(null), 1500) }
      if (r.events.includes('golden')) { playTap(); setGolden(true); window.setTimeout(() => setGolden(false), 2200) }
      if (r.events.includes('end')) { playLevelDone(); setPhase('done'); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  // 손가락: 처음 누른 곳이 어느 편 쪽인지로 그 손가락이 움직일 아바타를 정한다(빨강은 왼쪽/아래, 보라는 오른쪽/위). 두 사람이 동시에 할 수 있다
  const down = (e: React.PointerEvent) => {
    if (phase !== 'play' || (e.target as HTMLElement).closest('button')) return
    const r = host.current!.getBoundingClientRect()
    const sx = e.clientX - r.left, sy = e.clientY - r.top
    // 1인 게임은 화면 어디를 눌러도 내 아바타(빨강)가 움직인다
    const team: Team = players === 1 ? 0 : portrait ? (sy > fieldTop + fh / 2 ? 0 : 1) : (sx < left + fw / 2 ? 0 : 1)
    pointers.current.set(e.pointerId, team)
    targets.current[team] = toField(sx, sy)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const team = pointers.current.get(e.pointerId)
    if (team === undefined) return
    const r = host.current!.getBoundingClientRect()
    targets.current[team] = toField(e.clientX - r.left, e.clientY - r.top)
  }
  const up = (e: React.PointerEvent) => {
    const team = pointers.current.get(e.pointerId)
    pointers.current.delete(e.pointerId)
    if (team !== undefined && ![...pointers.current.values()].includes(team)) targets.current[team] = null
  }

  const start = () => {
    playTap()
    const m = newMatch(avatars, animals, [false, players === 1])
    live.current = m; setMatch(m); targets.current = [null, null]; setGoal(null); setPhase('play')
  }
  const teamName = (t: Team) => `${avatarById(avatars[t]).name.ko}팀`
  const left_ = Math.max(0, Math.ceil(MATCH_SECONDS - match.time))

  return (
    <section ref={host} aria-label="축구" tabIndex={0} className="relative h-full touch-none overflow-hidden rounded-3xl bg-[#7cc26b] outline-none select-none"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onKeyDown={(e) => { keys.current.add(e.key.length === 1 ? e.key.toLowerCase() : e.key); if (e.key.startsWith('Arrow')) e.preventDefault() }}
      onKeyUp={(e) => keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key)}>
      {/* 경기장: 줄무늬 잔디, 흰 선, 양쪽 골대 */}
      <div aria-hidden className="absolute rounded-lg" style={{ left, top: fieldTop, width: fw, height: fh, background: `repeating-linear-gradient(${portrait ? '0deg' : '90deg'}, #6fbf5f 0 ${scale * 10}px, #63b254 ${scale * 10}px ${scale * 20}px)`, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.9)' }} />
      <div aria-hidden className="absolute bg-white/90" style={portrait ? { ...rect(FW / 2, 0, FW / 2, FH), height: 3 } : { ...rect(FW / 2, 0, FW / 2, FH), width: 3 }} />
      <div aria-hidden className="absolute rounded-full border-[3px] border-white/90" style={{ ...rect(FW / 2 - 8, FH / 2 - 8, FW / 2 + 8, FH / 2 + 8) }} />
      {[0, 1].map((t) => <div key={`box${t}`} aria-hidden className="absolute border-[3px] border-white/90" style={rect(t ? FW - 14 : 0, 14, t ? FW : 14, FH - 14)} />)}
      {[0, 1].map((t) => <div key={`goal${t}`} aria-hidden className="absolute rounded-sm border-[3px] border-white" style={{ ...rect(t ? FW : -3.5, GOAL_TOP, t ? FW + 3.5 : 0, GOAL_BOT), background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 3px, transparent 3px 8px)', boxShadow: `0 0 0 2px ${KIT[t === 0 ? 0 : 1].color}` }} />)}
      {/* 골대 옆 팀 이름: 이 골대를 지키는 팀(빨강 팀은 왼쪽/아래 골대). 가로 화면은 골대 바깥 옆에 세로 글씨로, 세로 화면은 골대 오른쪽 옆에(골키퍼 표시를 가리지 않게) */}
      {([0, 1] as Team[]).map((t) => {
        const g = rect(t === 0 ? -3.5 : FW, GOAL_TOP, t === 0 ? 0 : FW + 3.5, GOAL_BOT)
        const style: React.CSSProperties = portrait
          ? { left: g.left + g.width + 6, top: g.top + g.height / 2, transform: 'translateY(-50%)' }
          : { left: t === 0 ? g.left - 3 : g.left + g.width + 3, top: g.top + g.height / 2, transform: `translate(${t === 0 ? '-100%' : '0'}, -50%)`, writingMode: 'vertical-rl' }
        return <span key={`gl${t}`} aria-hidden className="pointer-events-none absolute z-[1600] rounded-full px-1.5 py-1 text-[11px] leading-none font-black whitespace-nowrap text-white shadow" style={{ ...style, background: KIT[t].color }}>{teamName(t)} 골대</span>
      })}

      {/* 선수들(아래쪽일수록 앞에) */}
      {match.players.map((p, i) => {
        const s = toScreen(p.x, p.y)
        const human = p.role === 'human'
        const h = (human ? 12 : 8) * scale
        const w = human ? h * (1024 / 1536) : h
        const flip = portrait ? 1 : p.dir
        return (
          <div key={i} aria-hidden className="pointer-events-none absolute" style={{ left: s.x - w / 2, top: s.y - h, width: w, height: h, zIndex: Math.round(s.y) }}>
            <div className="relative h-full w-full" style={{ transform: `scaleX(${flip})` }}>
              {human ? <KitFigure id={p.who as string} team={p.team} /> : <img src={assetUrl(`cafe/stand/${CALL_ANIMALS[p.who as number].img}_stand.webp`)} alt="" draggable={false} className="h-full w-full object-contain" />}
            </div>
            {/* 발밑 팀 색 동그라미 */}
            <span className="absolute left-1/2 -translate-x-1/2 rounded-[50%]" style={{ bottom: -3, width: w * 0.8, height: 7, background: KIT[p.team].color, opacity: 0.55, zIndex: -1 }} />
            {/* 골키퍼: 손에 장갑, 머리 위에 팀 색 "골키퍼" 표시 */}
            {p.role === 'keeper' && <>
              <span className="absolute left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-black whitespace-nowrap text-white shadow" style={{ top: -14, background: KIT[p.team].color }}>🧤 골키퍼</span>
              {[-1, 1].map((sd) => <span key={sd} className="absolute leading-none" style={{ top: '48%', [sd < 0 ? 'left' : 'right']: '-6%', fontSize: w * 0.3, transform: `scaleX(${sd})` }}>🧤</span>)}
            </>}
            {human && <span className="absolute left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[11px] font-black whitespace-nowrap text-white shadow" style={{ top: -16, background: KIT[p.team].color }}>{avatarById(p.who as string).name.ko}</span>}
          </div>
        )
      })}
      {(() => { const s = toScreen(match.ball.x, match.ball.y); const d = 3.6 * scale; return <span aria-hidden className="pointer-events-none absolute flex items-center justify-center leading-none drop-shadow" style={{ left: s.x - d / 2, top: s.y - d, width: d, height: d, fontSize: d, zIndex: 1500 }}>⚽</span> })()}

      {/* 점수판 */}
      <header className="absolute inset-x-2 top-2 z-[2000] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 font-black shadow">
          <span style={{ color: KIT[0].color }}>{teamName(0)}</span>
          <span className="text-lg">{match.score[0]} : {match.score[1]}</span>
          <span style={{ color: KIT[1].color }}>{teamName(1)}</span>
          {phase === 'play' && <span className="ml-1 text-xs text-black/50">{match.time >= MATCH_SECONDS ? '⚽ 골든골' : `⏱ ${Math.floor(left_ / 60)}:${String(left_ % 60).padStart(2, '0')}`}</span>}
        </div>
        <button aria-label="닫기" onClick={onExit} className="h-10 w-10 rounded-full bg-white/95 font-bold shadow">✕</button>
      </header>
      {golden && goal === null && <div className="pointer-events-none absolute inset-0 z-[2001] flex items-center justify-center"><p className="m-0 rounded-3xl bg-white/95 px-6 py-4 text-center text-2xl font-black text-[#3d6b2f] shadow-xl">동점! 골든골 ⚽<br /><span className="text-base">먼저 넣는 팀이 이겨요</span></p></div>}
      {goal !== null && <div className="pointer-events-none absolute inset-0 z-[2001] flex items-center justify-center"><p className="m-0 rounded-3xl bg-white/95 px-6 py-4 text-center text-3xl font-black shadow-xl" style={{ color: KIT[goal].color }}>골!! ⚽🎉<br /><span className="text-lg">{teamName(goal)}</span></p></div>}

      {/* 시작 전: 아바타 2명, 동물 팀 나누기 / 끝: 결과 */}
      {phase !== 'play' && (
        <div className="absolute inset-0 z-[2002] flex items-center justify-center bg-black/30 p-3">
          <div className="sheet-in max-h-full w-full max-w-md overflow-y-auto rounded-3xl bg-[#fffaf0] p-4 text-center shadow-2xl">
            {phase === 'done' ? (
              <>
                <p className="m-0 text-4xl">🏆</p>
                <h2 className="my-2 text-xl font-black">{match.score[0] === match.score[1] ? '비겼어요! 둘 다 잘했어요' : `${teamName(match.score[0] > match.score[1] ? 0 : 1)} 이겼어요!`}</h2>
                <p className="m-0 text-2xl font-black"><span style={{ color: KIT[0].color }}>{match.score[0]}</span> : <span style={{ color: KIT[1].color }}>{match.score[1]}</span></p>
              </>
            ) : <h2 className="mt-0 mb-1 text-xl font-black">⚽ 축구</h2>}
            {/* 1인·2인 고르기 */}
            <div role="radiogroup" aria-label="몇 명이 할까요" className="my-2 grid grid-cols-2 gap-2">
              {([1, 2] as const).map((n) => (
                <button key={n} role="radio" aria-checked={players === n} onClick={() => { playTap(); setPlayers(n); try { localStorage.setItem('ryuso.soccer.players', String(n)) } catch { /* 저장 못 해도 이번 판은 그대로 */ } }}
                  className={`min-h-14 rounded-2xl px-2 font-black ${players === n ? 'bg-[#4caf50] text-white shadow' : 'bg-white text-[#3d6b2f] ring-1 ring-black/10'}`}>
                  <span className="block text-base">{n === 1 ? '🙋 혼자 하기' : '👫 둘이 하기'}</span>
                  <span className="block text-[11px] font-bold opacity-80">{n === 1 ? '보라 팀은 컴퓨터가 해요' : '한 화면에서 한 팀씩'}</span>
                </button>
              ))}
            </div>
            <p className="mt-0 mb-2 rounded-xl bg-white px-2 py-1.5 text-xs font-bold text-[#3d6b2f]">{players === 1 ? '화면을 누르고 끌면 내 아바타가 따라 달려요' : `${portrait ? '아래쪽은 빨강, 위쪽은 보라' : '왼쪽은 빨강, 오른쪽은 보라'} 팀 화면이에요. 누르고 끌면 따라 달리고`}, 공에 닿으면 저절로 차요!</p>
            <div className="grid grid-cols-2 gap-2">
              {([0, 1] as Team[]).map((t) => (
                <div key={t} className="rounded-2xl p-2" style={{ background: KIT[t].soft, boxShadow: `inset 0 0 0 2px ${KIT[t].color}` }}>
                  <p className="m-0 mb-1 text-sm font-black" style={{ color: KIT[t].color }}>{KIT[t].name} 팀 {players === 1 ? (t === 0 ? '· 나' : '· 컴퓨터') : ''}</p>
                  <div className="grid grid-cols-4 gap-1">
                    {AVATARS.map((a) => {
                      const on = avatars[t] === a.id, taken = avatars[t === 0 ? 1 : 0] === a.id
                      return (
                        <button key={a.id} aria-pressed={on} aria-label={`${KIT[t].name} 팀 ${a.name.ko}`} disabled={taken}
                          onClick={() => { playTap(); setAvatars((v) => (t === 0 ? [a.id, v[1]] : [v[0], a.id])) }}
                          className={`flex flex-col items-center rounded-xl p-0.5 disabled:opacity-30 ${on ? 'bg-white' : ''}`} style={on ? { boxShadow: `0 0 0 2px ${KIT[t].color}` } : undefined}>
                          <AvatarHead avatar={a} className="aspect-square h-auto w-full" />
                          <span className="text-[10px] font-bold">{a.name.ko}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-1">
                    {animals[t].map((n) => <img key={n} src={assetUrl(`cafe/face/${CALL_ANIMALS[n].img}.webp`)} alt={CALL_ANIMALS[n].name} className="aspect-square w-full rounded-full bg-white object-contain" />)}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { playTap(); setAnimals(splitAnimals()) }} className="mt-2 min-h-10 w-full rounded-full bg-white font-bold text-[#6b4b52] shadow-sm">🔀 동물 친구 팀 섞기</button>
            <button onClick={start} className="mt-2 min-h-12 w-full rounded-full bg-[#4caf50] text-lg font-black text-white shadow">{phase === 'done' ? '⚽ 한 번 더' : '⚽ 경기 시작'}</button>
            <button onClick={onExit} className="mt-2 min-h-11 w-full rounded-full bg-white font-bold shadow-sm">나가기</button>
          </div>
        </div>
      )}
    </section>
  )
}
