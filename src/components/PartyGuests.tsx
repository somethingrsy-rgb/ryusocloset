import { useEffect, useRef, useState } from 'react'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { assetUrl } from '../lib/items'
import { arrive, byeLine, helloLine, leaveAll, partyLine, roomySpot, stepGuests, type Floor, type Guest } from '../lib/party'
import { playOrder, playTap } from '../lib/sound'
import { Ico } from './CafeGame'

interface Bubble { text: string; until: number }

/**
 * 동물 그림 칸(정사각형) 너비 ÷ 아바타 너비. 아바타 그림(1024×1536)에서 머리 꼭대기~발은 약 58~1504px(1444px),
 * 동물 그림(public/cafe/stand)은 귀 끝~발이 칸 높이에 꽉 차 있어서, 1444/1024 이면 동물 키 = 아바타 키.
 * 같은 키는 너무 커 보여서 아바타 키의 2/3 로 한다
 */
export const GUEST_PER_AVATAR_W = (1444 / 1024) * (2 / 3)

/**
 * 집에 초대한 동물 친구들: 하나씩 문으로 들어오며(카페 주문 벨 소리) 인사하고, 바닥을 자연스럽게 돌아다니며 이야기한다.
 * invite 가 바뀌면 새로 고른 친구만 더 들어오고, leave 가 켜지면 인사하고 모두 나간다.
 * size(y) 는 그 높이에서의 동물 그림 칸 너비(%, 칸 높이 = 동물 키 = 아바타 키의 2/3), z(y) 는 그 높이에서의 겹침 순서다.
 */
export function PartyGuests({ invite, leave, kid, floor, me, size, z, onGone, settled = [], orders = {}, eating = null, announce = null }: {
  invite: number[]; leave: boolean; kid?: string; floor: Floor; me: { x: number; y: number }; size: (y: number) => number; z: (y: number) => number; onGone: () => void
  /** 처음 그릴 때 이미 집에 와 있던 친구(주방에 다녀왔을 때): 문으로 다시 들어오지 않고 바로 바닥에 있다 */
  settled?: number[]
  /** 친구마다 주문한 메뉴(머리 옆에 작은 주문 표시) */
  orders?: Record<number, { menu: string; ready: boolean }>
  /** 같이 먹는 중: 친구마다 받은 음식 */
  eating?: Record<number, string> | null
  /** 친구들이 차례로 할 말(id 가 바뀔 때마다 한 번) */
  announce?: { id: number; lines: [number, string][] } | null
}) {
  const [guests, setGuests] = useState<Guest[]>([])
  const [bubbles, setBubbles] = useState<Record<number, Bubble>>({})
  const live = useRef<Guest[]>([])
  const floorRef = useRef(floor)
  floorRef.current = floor
  const meRef = useRef(me)
  meRef.current = me
  // 말풍선은 한 번에 하나만: 겹치면 읽기 어렵다
  const say = (animal: number, text: string, secs = 3) => setBubbles({ [animal]: { text, until: performance.now() + secs * 1000 } })

  // 이미 와 있던 친구는 바로 바닥의 빈 곳에 서 있다
  const settledRef = useRef(settled)
  useEffect(() => {
    for (const a of settledRef.current) {
      if (live.current.some((g) => g.animal === a)) continue
      const t = roomySpot(floorRef.current, [meRef.current, ...live.current])
      live.current = [...live.current, { animal: a, x: t.x, y: t.y, tx: t.x, ty: t.y, wait: Math.random() * 2, dir: 1, entering: false, leaving: false }]
    }
    setGuests(live.current)
  }, [])
  // 차례로 말하기(주문할 때·같이 먹을 때): 1.6초 간격으로 한 친구씩
  useEffect(() => {
    if (!announce) return
    const timers = announce.lines.map(([a, text], k) => window.setTimeout(() => say(a, text, 2.4), k * 1600))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announce?.id])

  // 새로 초대한 친구는 1.8초 간격으로 한 명씩 들어온다(앞 친구 인사를 다 듣고 다음 친구가 온다)
  useEffect(() => {
    const timers: number[] = []
    const fresh = invite.filter((a) => !live.current.some((g) => g.animal === a) && !settledRef.current.includes(a))
    fresh.forEach((a, k) => timers.push(window.setTimeout(() => {
      playOrder()
      live.current = [...live.current.filter((g) => g.animal !== a), arrive(a, floorRef.current, Math.random, [meRef.current, ...live.current.flatMap((g) => [g, { x: g.tx, y: g.ty }])])]
      setGuests(live.current)
    }, k * 1800)))
    return () => timers.forEach(clearTimeout)
  }, [invite])

  useEffect(() => {
    if (!leave) return
    if (live.current[0]) say(live.current[0].animal, byeLine(kid), 2.5)
    const t = window.setTimeout(() => { live.current = leaveAll(live.current); setGuests(live.current) }, 1800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leave])

  // 걷기
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      if (live.current.length) {
        const r = stepGuests(live.current, dt, floorRef.current, Math.random, [meRef.current])
        live.current = r.guests
        setGuests(r.guests)
        r.arrivedNow.forEach((a) => say(a, helloLine(kid), 2.6))
        if (r.gone.length && !r.guests.length) onGone()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 이야기: 4~6초마다 한 친구가 말하고, 말풍선은 시간이 지나면 사라진다
  useEffect(() => {
    if (leave) return
    let t = 0
    const next = () => {
      t = window.setTimeout(() => {
        const here = live.current.filter((g) => !g.entering && !g.leaving)
        if (here.length) {
          const g = here[Math.floor(Math.random() * here.length)]
          say(g.animal, partyLine(g.animal, here.map((h) => h.animal).filter((a) => a !== g.animal), kid))
        }
        next()
      }, 3800 + Math.random() * 2200)
    }
    next()
    const clean = window.setInterval(() => setBubbles((b) => Object.fromEntries(Object.entries(b).filter(([, v]) => v.until > performance.now()))), 500)
    return () => { clearTimeout(t); clearInterval(clean) }
  }, [leave, kid])

  return <>
    {guests.map((g) => {
      const a = CALL_ANIMALS[g.animal]
      const w = size(g.y)
      return (
        <div key={a.img} className="absolute" style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${w}%`, aspectRatio: '1 / 1', transform: 'translate(-50%, -99.5%)', zIndex: z(g.y) }}>
          {/* 누르면 그 친구가 한마디 한다 */}
          <button aria-label={`${a.name}랑 이야기하기`} onPointerUp={(e) => e.stopPropagation()} onClick={() => { playTap(); say(g.animal, partyLine(g.animal, guests.map((h) => h.animal).filter((x) => x !== g.animal), kid)) }}
            className={`relative block h-full w-full border-0 bg-transparent p-0 ${g.wait > 0 ? '' : 'walk-bob'}`}>
            {/* 서 있는 그림(public/cafe/stand), 말할 때는 손 흔드는 그림. 두 장을 겹쳐 두고 보이기만 바꿔서 바뀔 때 깜빡이지 않는다 */}
            {(['stand', 'wave'] as const).map((pose) => (
              <img key={pose} src={assetUrl(`cafe/stand/${a.img}_${pose}.webp`)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_4px_3px_rgba(80,50,40,0.25)]"
                style={{ transform: `scaleX(${g.dir})`, visibility: (pose === 'wave') === !!bubbles[g.animal] ? 'visible' : 'hidden' }} />
            ))}
            {/* 같이 먹는 중: 받은 음식을 앞에 들고 냠냠 */}
            {eating?.[g.animal] && <span aria-hidden className="party-yum absolute left-1/2 block w-[46%] -translate-x-1/2" style={{ bottom: '6%' }}><Ico id={eating[g.animal]} className="h-auto w-full drop-shadow-[0_2px_2px_rgba(80,50,40,0.35)]" /></span>}
          </button>
          {/* 주문 표시: 머리 옆 작은 동그라미에 메뉴 그림(만드는 중 ⏳, 다 되면 ✅) */}
          {!eating && orders[g.animal] && (
            <span aria-label={orders[g.animal].ready ? '음식 완성' : '주문함'} className={`pointer-events-none absolute top-[4%] ${g.x > 60 ? '-left-[14%]' : '-right-[14%]'} flex aspect-square w-[42%] items-center justify-center rounded-full bg-white/95 shadow-md ring-2 ring-[#ffb3c6]`}>
              <Ico id={orders[g.animal].menu} className="h-[80%] w-[80%]" />
              <span aria-hidden className="absolute -right-[12%] -bottom-[12%] text-[11px] leading-none">{orders[g.animal].ready ? '✅' : '⏳'}</span>
            </span>
          )}
        </div>
      )
    })}
    {/* 말풍선은 친구 그림과 같은 자리·크기의 칸에 따로 그려 아바타·소품보다 늘 위에 보이게 한다 */}
    {guests.map((g) => {
      const b = bubbles[g.animal]
      return b ? (
        <div key={`b-${g.animal}`} aria-live="polite" className="pointer-events-none absolute" style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${size(g.y)}%`, aspectRatio: '1 / 1', transform: 'translate(-50%, -99.5%)', zIndex: 100000 }}>
          <p className={`absolute bottom-[96%] m-0 w-max max-w-[11rem] rounded-2xl bg-white px-2.5 py-1.5 text-center text-[13px] leading-snug font-bold text-[#6b4b52] shadow-md ${g.x < 25 ? 'left-0' : g.x > 75 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>{b.text}</p>
        </div>
      ) : null
    })}
  </>
}

/**
 * 파티 초대 창: 카페 동물 친구 얼굴을 여러 명 골라서 초대한다(이미 온 친구는 표시).
 * 달리기 친구 고르기도 같은 창을 쓴다(title·cta 로 글자를 바꾸고, initial 로 지난번에 고른 친구를 미리 골라 둔다. 아무도 안 골라도 된다. single 이면 한 명만 고른다)
 */
export function PartyInvite({ here, onInvite, onClose, initial = [], title = '🎉 파티에 누구를 초대할까요?', cta = '💌 초대하기', allowNone = false, single = false, max, ctaNone, note }: { here: number[]; onInvite: (animals: number[]) => void; onClose: () => void; initial?: number[]; title?: string; cta?: string; allowNone?: boolean; single?: boolean; /** 이만큼까지만 고른다(더 고르면 먼저 고른 친구가 빠진다) */ max?: number; /** 아무도 안 골랐을 때 버튼 글자 */ ctaNone?: string; /** 제목 아래 안내 글자 */ note?: string }) {
  const [picked, setPicked] = useState<number[]>(initial)
  const toggle = (i: number) => { playTap(); setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : single ? [i] : max && p.length >= max ? [...p.slice(p.length - max + 1), i] : [...p, i])) }
  const free = CALL_ANIMALS.map((_, i) => i).filter((i) => !here.includes(i))
  return (
    <div role="dialog" aria-modal aria-label="파티 초대" className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet-in flex max-h-full w-full max-w-sm flex-col rounded-3xl bg-[#fff8fb] p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="m-0 text-lg font-black text-[#8a4b55]">{title}</p>
          <button aria-label="닫기" onClick={onClose} className="h-9 w-9 rounded-full bg-white text-base font-bold text-[#8a4b55] shadow-sm">✕</button>
        </div>
        <p className="mt-1 mb-2 text-xs text-black/45">{note ?? (single ? '한 친구를 골라요' : '여러 친구를 골라도 돼요')}</p>
        <div className="grid min-h-0 grid-cols-4 gap-2 overflow-y-auto p-1.5">
          {CALL_ANIMALS.map((a, i) => {
            const on = picked.includes(i), came = here.includes(i)
            return (
              <button key={a.img} aria-pressed={on} aria-label={came ? `${a.name} (이미 왔어요)` : a.name} disabled={came} onClick={() => toggle(i)}
                className={`relative flex flex-col items-center rounded-2xl p-1.5 transition active:scale-95 disabled:opacity-45 ${on ? 'bg-[#ffd6e3] ring-2 ring-[#ff8fab]' : 'bg-white ring-1 ring-black/5'}`}>
                <img src={assetUrl(`cafe/face/${a.img}.webp`)} alt="" draggable={false} className="aspect-square w-full object-contain" />
                <span className="text-xs font-bold text-[#8a4b55]">{a.name}</span>
                {(on || came) && <span aria-hidden className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ff8fab] text-[11px] text-white">✓</span>}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex gap-2">
          {!single && !max && <button disabled={!free.length} onClick={() => { playTap(); setPicked(picked.length === free.length ? [] : free) }} className="min-h-11 flex-1 rounded-full bg-white font-bold text-[#8a4b55] shadow-sm disabled:opacity-40">{picked.length === free.length && free.length ? '모두 빼기' : '모두 고르기'}</button>}
          <button disabled={!picked.length && !allowNone} onClick={() => onInvite(picked)} className="min-h-11 flex-[1.4] rounded-full bg-[#ff8fab] font-bold text-white shadow disabled:opacity-40">{!picked.length && ctaNone ? ctaNone : <>{cta}{picked.length ? ` (${picked.length})` : ''}</>}</button>
        </div>
      </div>
    </div>
  )
}
