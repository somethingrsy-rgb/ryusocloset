/**
 * 같이 놀기(멀티플레이어) 단추와 채팅 칸. 앱 화면 왼쪽에 늘 하나(App 이 그린다):
 * 한 번 들어가면 어느 탭에 있든 계속 같이 놀기 중이고 채팅도 계속된다. 화면을 덜 가리게: 새 말은 아래에 투명 글자로 8초 떴다 사라지고,
 * 말하는 줄은 아래 한 줄(👥 로 열고 닫음, 20초 안 쓰면 닫힘), 지난 대화와 나가기는 📜 안에.
 * Firebase 설정이 없으면(지금의 배포처럼) 아무것도 그리지 않는다 → 기존 화면 그대로.
 */
import { Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { listen, speechSupported } from '../lib/mp/speech'
import { assetUrl } from '../lib/items'
import { getAvatar } from '../lib/avatars'
import { multiplayerAvailable } from '../lib/mp/config'
import { MAX_CHAT, MAX_NAME, MAX_PLAYERS } from '../lib/mp/core'
import { getMp, joinMp, leaveMp, savedName, say, setLook, subscribeMp, visitHome } from '../lib/mp/session'
import type { Outfit, Tweaks } from '../lib/types'

const HomeVisit = lazy(() => import('./HomeVisit').then((m) => ({ default: m.HomeVisit })))
/** 친구 집에 놀러 간 동안 그 집 화면을 띄운다(App 이 내용 칸 위에 그린다) */
export function HomeVisitGate({ outfit, tweaks }: { outfit: Outfit; tweaks: Tweaks }) {
  const v = useSyncExternalStore(subscribeMp, () => getMp().visiting)
  return v ? <Suspense fallback={null}><HomeVisit key={v} outfit={outfit} tweaks={tweaks} /></Suspense> : null
}
/** 초대 글은 이만큼(ms) 동안 「놀러 가기」 카드로 보인다 */
const INVITE_MS = 3 * 60 * 1000

/** 놀이 화면이 아래쪽 단추를 쓰기 시작할 때 보내는 신호(말하는 줄을 닫는다) */
export const HUD_BUSY = 'ryuso:hud-busy'
/** 같이 놀기 칸(들어가기·말하는 줄)이 열렸는지: 위 탭 줄의 「친구」 단추가 연다(앱 어디서든 하나) */
let panelOpen = false
const panelSubs = new Set<() => void>()
const setPanel = (v: boolean) => { if (panelOpen === v) return; panelOpen = v; panelSubs.forEach((f) => f()) }
const subscribePanel = (f: () => void) => { panelSubs.add(f); return () => { panelSubs.delete(f) } }
const getPanel = () => panelOpen

/** 위 탭 줄 맨 앞 「친구」 단추: 누르면 같이 놀기(들어가기·채팅) 칸을 열고 닫는다. 들어가 있으면 인원이 붙는다 */
export function FriendTab() {
  const mp = useSyncExternalStore(subscribeMp, getMp)
  const open = useSyncExternalStore(subscribePanel, getPanel)
  if (!multiplayerAvailable) return null
  const on = mp.status === 'on'
  return (
    <button aria-label="친구 · 같이 놀기" aria-expanded={open} onClick={() => setPanel(!open)}
      className={`relative flex min-h-11 shrink-0 flex-1 items-center justify-center rounded-full px-0.5 transition ${open ? 'bg-[#ead8f6] shadow' : ''}`}>
      <img src={assetUrl('assets/tabs2/friend.webp')} alt="" draggable={false} className="h-10 w-10 object-contain" />
      {on && <span className="absolute -top-1 right-0 rounded-full bg-[#7a3d8f] px-1.5 text-[10px] leading-4 font-black text-white shadow">{Object.keys(mp.players).length}/{MAX_PLAYERS}</span>}
    </button>
  )
}
/** 내가 방금 한 말: 화면에 보이는 내 아바타(data-me-avatar) 머리 위 말풍선. 3D 장소는 3D 말풍선이 따로 그린다 */
/** 아바타가 다른 화면에 가려졌는지: 그 점 맨 위가 다른 3D 화면(canvas)이거나, 아바타를 품지 않은 창·덮개(dialog·region·고정 덮개) 안이면 가려진 것.
 *  (아바타 그림은 눌리지 않게(pointer-events: none) 되어 있어서 맨 위 요소가 아바타 자신이 아닐 수 있다) */
function covered(el: HTMLElement, x: number, y: number) {
  const top = document.elementFromPoint(x, y)
  if (!top) return true
  const root = el.closest('section, [role=region], [role=dialog]') ?? el.parentElement
  if (top.tagName === 'CANVAS' && !root?.contains(top)) return true
  const box = top.closest('[role=dialog], [role=region]')
  return !!box && !box.contains(el)
}

function MyBubble({ text, onShown }: { text: string; onShown: (v: boolean) => void }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    let raf = 0, last = ''
    const find = () => {
      // 보이는 것만(다른 화면이나 창 밑에 가려진 아바타는 빼고): 가운데 점에 맨 위로 보이는 것이 그 아바타일 때
      let best: DOMRect | null = null, head: { x: number; y: number } | null = null
      // 3D 화면이 알려 주는 머리 위 점(주방 3D 등)
      for (const el of document.querySelectorAll<HTMLElement>('[data-me-head]')) {
        const r = el.getBoundingClientRect()
        if (el.style.display === 'none' || r.top < 0 || r.top > innerHeight || r.left < 0 || r.left > innerWidth) continue
        if (!covered(el, r.left, Math.min(innerHeight - 1, r.top + 20))) head = { x: Math.round(r.left), y: Math.round(r.top) }
      }
      for (const el of head ? [] : document.querySelectorAll<HTMLElement>('[data-me-avatar]')) {
        const r = el.getBoundingClientRect()
        if (r.width < 24 || r.bottom < 0 || r.top > innerHeight) continue
        if (covered(el, r.left + r.width / 2, r.top + r.height * 0.45)) continue
        if (!best || r.width > best.width) best = r
      }
      const next = head ?? (best ? { x: Math.round(best.left + best.width / 2), y: Math.round(best.top + best.height * 0.07) } : null)
      const key = next ? `${next.x},${next.y}` : ''
      if (key !== last) { last = key; setAt(next); onShown(!!next) }
      raf = requestAnimationFrame(find)
    }
    find()
    return () => { cancelAnimationFrame(raf); onShown(false) }
  }, [onShown])
  if (!at) return null
  // 머리에서 조금 떨어진 위에 띄운다. 위 탭 줄(약 5rem)에 닿으면 머리 오른쪽 옆으로
  const side = at.y - 18 < 110
  return createPortal(
    <div aria-hidden className={`pointer-events-none fixed z-[70] max-w-[11rem] ${side ? '' : '-translate-x-1/2 -translate-y-full'}`} style={side ? { left: at.x + 52, top: Math.max(110, at.y + 6) } : { left: at.x, top: at.y - 18 }}>
      <div className="relative rounded-2xl bg-white px-3 py-1.5 text-center text-sm leading-snug font-bold text-[#c04a5a] shadow-lg ring-1 ring-black/5">
        {text}
        <span className={`absolute h-3 w-3 rotate-45 bg-white ${side ? 'top-3 -left-1.5' : '-bottom-1.5 left-1/2 -translate-x-1/2'}`} />
      </div>
    </div>,
    document.body,
  )
}

const FADE_MS = 8000
const IDLE_MS = 20000

export function MultiplayerBar({ outfit, lift = false }: { outfit: Outfit; /** 화면 아래 왼쪽에 큰 단추가 있는 화면(방)이면 말하는 줄을 그 위로 올린다 */ lift?: boolean }) {
  const mp = useSyncExternalStore(subscribeMp, getMp)
  const open = useSyncExternalStore(subscribePanel, getPanel)
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setPanel(typeof v === 'function' ? v(getPanel()) : v)
  const [name, setName] = useState(savedName)
  const [text, setText] = useState('')
  // 말로 채팅: 🎤 를 누르고 말하면 글로 바뀌고, 말을 마치면 바로 보낸다
  const [hearing, setHearing] = useState(false)
  const [micNote, setMicNote] = useState('')
  const stopRef = useRef<() => void>(() => {})
  useEffect(() => () => stopRef.current(), [])
  const mic = () => {
    if (hearing) { stopRef.current(); return }
    setMicNote(''); setText(''); setHearing(true)
    stopRef.current = listen((t) => setText(t), (t, err) => {
      setHearing(false)
      if (t) { say(t); setText(''); setUsed((n) => n + 1) }
      else setMicNote(err === 'not-allowed' || err === 'service-not-allowed' ? '마이크를 쓸 수 있게 허락해 주세요' : '잘 못 들었어요. 다시 말해 볼까요?')
    })
  }
  // 새 말은 화면 아래에 투명 글자로 8초 보였다가 사라진다(최근 3줄, 눌러도 뒤의 단추를 막지 않는다)
  const [now, setNow] = useState(() => Date.now())
  // 내가 한 말은 내 아바타 머리 위 말풍선으로(3D 장소는 3D 말풍선). 아래 글줄에는 친구가 한 말만
  const [bubbleShown, setBubbleShown] = useState(false)
  const in3d = (mp.room === 'cafe' || mp.room === 'farm' || mp.room === 'walk') && !mp.visiting
  const mine = mp.status === 'on' ? [...mp.chat].reverse().find((c) => c.uid === mp.uid && now - c.t < FADE_MS) : undefined
  const fresh = mp.status === 'on' ? mp.chat.filter((c) => now - c.t < FADE_MS && !(c.uid === mp.uid && (bubbleShown || in3d))).slice(-3) : []
  const newest = mp.chat[mp.chat.length - 1]?.t ?? 0
  useEffect(() => { setNow(Date.now()) }, [newest])
  useEffect(() => { if (!fresh.length && !mine) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [fresh.length, mine])
  // 말하는 줄: 한동안(20초) 안 쓰면 저절로 닫힌다(화면을 덜 가리게)
  const [history, setHistory] = useState(false)
  const [askLeave, setAskLeave] = useState(false)
  const [used, setUsed] = useState(0)
  const touch = () => setUsed((n) => n + 1)
  useEffect(() => { if (!open || hearing || history) return; const t = setTimeout(() => setOpen(false), IDLE_MS); return () => clearTimeout(t) }, [open, hearing, history, used])
  // 놀이 화면이 바쁠 때(몬스터 마법 풀기 시작 등) 말하는 줄을 닫아서 아래 단추를 가리지 않게
  useEffect(() => { const f = () => { setOpen(false); setHistory(false); setAskLeave(false) }; window.addEventListener(HUD_BUSY, f); return () => window.removeEventListener(HUD_BUSY, f) }, [])
  // 친구가 보낸 집 초대(최근 것 하나): 「놀러 가기」 카드
  const [dismissed, setDismissed] = useState<string | null>(null)
  const invite = mp.status === 'on' ? [...mp.chat].reverse().find((c) => c.home && c.uid !== mp.uid && Date.now() - c.t < INVITE_MS) : undefined
  const showInvite = invite && invite.id !== dismissed && mp.visiting !== invite.home && !!mp.players[invite.uid]
  const look = { avatar: getAvatar().id, outfit: outfit as Record<string, string> }
  const lookKey = JSON.stringify(look)
  // 옷을 갈아입으면 다른 사람 화면에도
  useEffect(() => { if (mp.status === 'on') setLook(JSON.parse(lookKey)) }, [lookKey, mp.status])
  if (!multiplayerAvailable) return null
  const on = mp.status === 'on'
  const btn = 'h-9 rounded-full px-3 text-sm font-black shadow'
  const say1 = (t: string) => { say(t); touch() }
  return (
    <>
      {mine && !in3d && <MyBubble key={mine.id} text={mine.text} onShown={setBubbleShown} />}
      {/* 초대장 카드 + 들어가기 칸(「친구」 단추로 연다) */}
      <div className="pointer-events-none absolute left-2 z-[60] flex w-[min(15rem,calc(100%-1rem))] flex-col items-start gap-1.5" style={{ top: '0.5rem' }}>
        {open && !on && (
          <div className="pointer-events-auto flex w-full flex-col gap-2 rounded-2xl bg-white/95 p-2.5 shadow-lg">
            <label className="text-xs font-bold text-[#6b4b52]">닉네임
              <input value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} placeholder="이름" className="mt-1 h-9 w-full rounded-xl border border-[#f0c6cd] px-2 text-sm" />
            </label>
            <button disabled={mp.status === 'connecting' || !name.trim()} onClick={() => { joinMp(name, look); touch() }} className={`${btn} bg-[#ff8fab] text-white disabled:opacity-50`}>
              {mp.status === 'connecting' ? '연결하는 중…' : '들어가기'}
            </button>
            {mp.status === 'full' && <p className="m-0 text-xs font-bold text-[#d0587a]">지금은 {MAX_PLAYERS}명이 꽉 찼어요. 조금 뒤에 다시 해 봐요</p>}
            {mp.status === 'error' && <p className="m-0 text-xs font-bold text-[#d0587a]">연결하지 못했어요 · {mp.error}</p>}
          </div>
        )}
      </div>
      {/* 친구가 보낸 초대장: 화면 가운데 위쪽에(위 단추 줄을 가리지 않게) */}
      {showInvite && invite && (
      <div className="pointer-events-none absolute inset-x-0 z-[60] flex justify-center" style={{ top: '30%' }}>
          <div role="dialog" aria-label="초대장" className="pointer-events-auto flex w-[min(17rem,calc(100%-1rem))] flex-col gap-1.5 rounded-2xl border-2 border-[#ffc2d4] bg-white/97 p-2.5 shadow-lg">
            <p className="m-0 text-xs leading-snug font-bold text-[#6b4b52]">💌 <b className="text-[#7a3d8f]">{invite.name}</b>의 초대장<br /><span className="text-[#c04a5a]">「{invite.text}」</span></p>
            <div className="flex gap-1.5">
              <button onClick={() => { setDismissed(invite.id); visitHome(invite.home!) }} className="h-9 flex-1 rounded-full bg-[#ff8fab] text-sm font-black text-white">수락</button>
              <button onClick={() => { setDismissed(invite.id); say(`💌 ${invite.name}, 고마워! 다음에 갈게`) }} className="h-9 flex-1 rounded-full bg-[#f3e6ea] text-sm font-bold text-[#6b4b52]">거절</button>
            </div>
          </div>
      </div>
      )}
      {/* 화면 아래: 사라지는 대화 + 말하는 줄 한 줄 */}
      {on && (
        <div className="pointer-events-none absolute inset-x-2 z-[60] flex flex-col items-start gap-1" style={{ bottom: lift && !mp.visiting ? '5.5rem' : '0.5rem' }}>
          {history && (
            <div role="dialog" aria-label="지난 대화" className="pointer-events-auto flex max-h-[40vh] w-[min(20rem,100%)] flex-col gap-1.5 rounded-2xl bg-white/95 p-2.5 shadow-lg">
              <ul className="m-0 flex min-h-0 list-none flex-col gap-0.5 overflow-y-auto p-0 text-xs">
                {mp.chat.map((c) => <li key={c.id} className="leading-snug"><b className={c.uid === mp.uid ? 'text-[#c04a5a]' : 'text-[#7a3d8f]'}>{c.name}</b> {c.text}</li>)}
                {!mp.chat.length && <li className="text-black/40">아직 나눈 이야기가 없어요</li>}
              </ul>
              {askLeave ? (
                <div className="flex items-center justify-end gap-1.5 text-xs font-bold">
                  <span className="text-[#6b4b52]">정말 나갈까요?</span>
                  <button onClick={() => { leaveMp(); setOpen(false); setHistory(false); setAskLeave(false) }} className="h-8 rounded-full bg-[#ff8fab] px-3 text-white">나가기</button>
                  <button onClick={() => setAskLeave(false)} className="h-8 rounded-full bg-[#f3e6ea] px-3">아니요</button>
                </div>
              ) : (
                <button onClick={() => setAskLeave(true)} className="self-end text-[11px] font-bold text-black/45">같이 놀기 나가기</button>
              )}
            </div>
          )}
          {!history && fresh.length > 0 && (
            <ul aria-live="polite" className="m-0 flex max-w-[min(20rem,100%)] list-none flex-col gap-0.5 p-0">
              {fresh.map((c) => (
                <li key={c.id} className="rounded-full bg-black/30 px-2.5 py-0.5 text-sm leading-snug font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] transition-opacity duration-700" style={{ opacity: now - c.t > FADE_MS - 1500 ? 0.35 : 1 }}>
                  <b className={c.uid === mp.uid ? 'text-[#ffd1dc]' : 'text-[#f1d4ff]'}>{c.name}</b> {c.text}
                </li>
              ))}
            </ul>
          )}
          {open && (
            <form className="pointer-events-auto flex w-[min(24rem,100%)] items-center gap-1.5 rounded-full bg-white/85 p-1 shadow-lg" onSubmit={(e) => { e.preventDefault(); say1(text); setText('') }}>
              {speechSupported && (
                <button type="button" aria-label={hearing ? '듣는 중 · 누르면 멈춰요' : '말로 채팅하기'} onClick={() => { mic(); touch() }}
                  className={`h-10 w-12 shrink-0 rounded-full text-xl shadow ${hearing ? 'animate-pulse bg-[#ff5c8a] text-white' : 'bg-[#ffe4ec]'}`}>🎤</button>
              )}
              <input aria-label="채팅" value={text} maxLength={MAX_CHAT} onFocus={touch} onChange={(e) => { setText(e.target.value); touch() }} placeholder={micNote || (hearing ? '듣고 있어요… 말해 봐요' : speechSupported ? '🎤 누르고 말하기' : '말하기…')} className={`h-9 min-w-0 flex-1 rounded-full border border-[#f0c6cd] bg-white px-3 text-sm ${micNote ? 'placeholder:text-[#d0587a]' : ''}`} />
              <button className="h-9 shrink-0 rounded-full bg-[#ff8fab] px-3 text-xs font-black text-white">보내기</button>
              <button type="button" aria-label="지난 대화" aria-pressed={history} onClick={() => { setHistory((h) => !h); setAskLeave(false); touch() }} className={`h-9 w-9 shrink-0 rounded-full text-base ${history ? 'bg-[#e9d5f5]' : 'bg-[#f6eef8]'}`}>📜</button>
            </form>
          )}
        </div>
      )}
    </>
  )
}
