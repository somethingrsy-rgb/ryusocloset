/**
 * 집 놀이(같이 놀기): 방 무대 위에 놀러 온 친구들과 바닥 음식을 그린다. 내 방(TravelScene)과 친구 집(HomeVisit)이 같이 쓴다.
 * 좌표는 방 무대에 대한 %(x 가로, y 발 높이). 내 위치는 여기서 세션에 알려 준다(친구 화면에 같은 자리로 보인다).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AVATARS } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import { MENU } from '../lib/recipes'
import { getMp, setPos, subscribeMp } from '../lib/mp/session'
import type { Look, PlayerState } from '../lib/mp/core'
import type { Vec } from '../lib/walk'
import { Ico } from './CafeGame'

/** 친구 옷 입은 그림(한 번 그린 것은 다시 쓴다) */
const figCache = new Map<string, Promise<string>>()
function useFigure(look: Look) {
  const key = JSON.stringify(look)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (!figCache.has(key)) figCache.set(key, renderFigure(look.outfit, {}, AVATARS.find((a) => a.id === look.avatar)).then((c) => c.toDataURL('image/png')))
    figCache.get(key)!.then((u) => { if (alive) setUrl(u) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return url
}

export const menuName = (id: string) => MENU.find((m) => m.id === id)?.ko ?? '간식'

function Friend({ p, said, w, feet, z }: { p: PlayerState; said: string | null; w: number; feet: number; z: number }) {
  const url = useFigure(p.look)
  return (
    <div className="pointer-events-none absolute transition-[left,top] duration-200 ease-linear" style={{ left: `${p.x}%`, top: `${p.z}%`, width: `${w}%`, aspectRatio: '1024 / 1536', transform: `translate(-50%, -${feet * 100}%)`, zIndex: z }}>
      <div className="absolute inset-x-0 -top-2 flex -translate-y-full flex-col items-center gap-0.5">
        {said && <span className="max-w-[10rem] rounded-2xl bg-white/95 px-2 py-0.5 text-center text-xs font-bold text-[#c04a5a] shadow">{said}</span>}
        <span className="rounded-full bg-[#7a3d8f]/85 px-2 text-[11px] font-black whitespace-nowrap text-white">{p.name}</span>
      </div>
      <div className="relative h-full w-full" style={{ transform: `scaleX(${p.dir})` }}>
        {url ? <img src={url} alt="" draggable={false} className={`h-full w-full ${p.moving ? 'walk-bob' : ''}`} /> : <div className="h-full w-full" />}
        {p.eat && <span aria-hidden className="party-yum absolute block" style={{ left: '76%', top: '42%', width: '41%', zIndex: 1000 }}><Ico id={p.eat} className="h-auto w-full" /></span>}
      </div>
    </div>
  )
}

export function HomeFriends({ host, me, dir, walking, w, feet, z }: {
  host: string
  me: Vec
  dir: 1 | -1
  walking: boolean
  /** 그 자리(y)에 선 사람 폭(무대 %) */
  w: (y: number) => number
  feet: number
  /** 그 자리(y)의 겹침 순서 */
  z: (y: number) => number
}) {
  const mp = useSyncExternalStore(subscribeMp, getMp)
  // 내 위치: 바뀔 때 + 1초마다(멈춘 자리를 놓치지 않게)
  const meRef = useRef({ me, dir, walking })
  meRef.current = { me, dir, walking }
  useEffect(() => { setPos(me.x, me.y, dir, walking) }, [me.x, me.y, dir, walking])
  useEffect(() => { const t = setInterval(() => { const m = meRef.current; setPos(m.me.x, m.me.y, m.dir, m.walking) }, 1000); return () => clearInterval(t) }, [])
  // 방금(6초 안에) 한 말은 머리 위에
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const friends = Object.entries(mp.players).filter(([uid, p]) => uid !== mp.uid && p.room === 'home' && p.host === host)
  const saidOf = (uid: string) => [...mp.chat].reverse().find((c) => c.uid === uid && now - c.t < 6000)?.text ?? null
  return (
    <>
      {friends.map(([uid, p]) => <Friend key={uid} p={p} said={saidOf(uid)} w={w(p.z)} feet={feet} z={z(p.z)} />)}
    </>
  )
}

/** 메뉴 고르기 창(같이 놀기 방 주문) */
export function FoodPicker({ onPick, onClose, title = '🍰 무엇을 꺼내 놓을까요?' }: { onPick: (menu: string) => void; onClose: () => void; title?: string }) {
  return (
    <div role="dialog" aria-label="메뉴 고르기" className="absolute inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center" onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-full w-full max-w-md flex-col rounded-3xl bg-[#fff8fb] p-4 shadow-2xl">
        <p className="mt-0 mb-2 text-center text-base font-black text-[#c04a5a]">{title}</p>
        <div className="grid min-h-0 grid-cols-4 gap-2 overflow-y-auto">
          {MENU.map((m) => (
            <button key={m.id} aria-label={m.ko} onClick={() => onPick(m.id)} className="flex flex-col items-center rounded-2xl bg-white p-1 shadow-sm active:scale-95">
              <Ico id={m.id} className="aspect-square w-full" />
              <span className="text-[10px] leading-tight font-bold text-[#6b4b52]">{m.ko}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 min-h-11 rounded-full bg-[#f3e6ea] text-sm font-bold">닫기</button>
      </div>
    </div>
  )
}
