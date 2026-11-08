/**
 * 같이 놀기(멀티플레이어) 단추와 채팅 칸. 앱 화면 왼쪽에 늘 하나(App 이 그린다):
 * 한 번 들어가면 어느 탭에 있든 계속 같이 놀기 중이고 채팅도 계속된다. 화면을 덜 가리게: 새 말은 아래에 투명 글자로 8초 떴다 사라지고,
 * 말하는 줄은 아래 한 줄(👥 로 열고 닫음, 20초 안 쓰면 닫힘), 지난 대화와 나가기는 📜 안에.
 * Firebase 설정이 없으면(지금의 배포처럼) 아무것도 그리지 않는다 → 기존 화면 그대로.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { listen, speechSupported } from '../lib/mp/speech'
import { getAvatar } from '../lib/avatars'
import { multiplayerAvailable } from '../lib/mp/config'
import { MAX_CHAT, MAX_NAME, MAX_PLAYERS } from '../lib/mp/core'
import { getMp, joinMp, leaveMp, savedName, say, setLook, subscribeMp } from '../lib/mp/session'
import type { Outfit } from '../lib/types'

/** 놀이 화면이 아래쪽 단추를 쓰기 시작할 때 보내는 신호(말하는 줄을 닫는다) */
export const HUD_BUSY = 'ryuso:hud-busy'
const FADE_MS = 8000
const IDLE_MS = 20000

export function MultiplayerBar({ outfit, lift = false }: { outfit: Outfit; /** 화면 아래 왼쪽에 큰 단추가 있는 화면(방)이면 말하는 줄을 그 위로 올린다 */ lift?: boolean }) {
  const mp = useSyncExternalStore(subscribeMp, getMp)
  const [open, setOpen] = useState(false)
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
  const fresh = mp.status === 'on' ? mp.chat.slice(-3).filter((c) => now - c.t < FADE_MS) : []
  const newest = mp.chat[mp.chat.length - 1]?.t ?? 0
  useEffect(() => { setNow(Date.now()) }, [newest])
  useEffect(() => { if (!fresh.length) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [fresh.length])
  // 말하는 줄: 한동안(20초) 안 쓰면 저절로 닫힌다(화면을 덜 가리게)
  const [history, setHistory] = useState(false)
  const [askLeave, setAskLeave] = useState(false)
  const [used, setUsed] = useState(0)
  const touch = () => setUsed((n) => n + 1)
  useEffect(() => { if (!open || hearing || history) return; const t = setTimeout(() => setOpen(false), IDLE_MS); return () => clearTimeout(t) }, [open, hearing, history, used])
  // 놀이 화면이 바쁠 때(몬스터 마법 풀기 시작 등) 말하는 줄을 닫아서 아래 단추를 가리지 않게
  useEffect(() => { const f = () => { setOpen(false); setHistory(false); setAskLeave(false) }; window.addEventListener(HUD_BUSY, f); return () => window.removeEventListener(HUD_BUSY, f) }, [])
  const look = { avatar: getAvatar().id, outfit: outfit as Record<string, string> }
  const lookKey = JSON.stringify(look)
  // 옷을 갈아입으면 다른 사람 화면에도
  useEffect(() => { if (mp.status === 'on') setLook(JSON.parse(lookKey)) }, [lookKey, mp.status])
  if (!multiplayerAvailable) return null
  const on = mp.status === 'on'
  const n = Object.keys(mp.players).length
  const btn = 'h-9 rounded-full px-3 text-sm font-black shadow'
  const say1 = (t: string) => { say(t); touch() }
  return (
    <>
      {/* 👥 단추(위 왼쪽) + 들어가기 칸 */}
      <div className="pointer-events-none absolute left-2 z-[60] flex w-[min(15rem,calc(100%-1rem))] flex-col items-start gap-1.5" style={{ top: 'max(22%, 7rem)' }}>
        <button aria-label="같이 놀기" aria-expanded={open} onClick={() => { setOpen((o) => !o); setHistory(false); setAskLeave(false); touch() }} className={`pointer-events-auto ${btn} ${on ? 'bg-[#7a3d8f] text-white' : 'bg-white/95 text-[#7a3d8f]'}`}>
          👥 {on ? `${n}/${MAX_PLAYERS}` : '같이 놀기'}{on && <span className="ml-1 text-xs">{open ? '▾' : '💬'}</span>}
        </button>
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
      {/* 화면 아래: 사라지는 대화 + 말하는 줄 한 줄 */}
      {on && (
        <div className="pointer-events-none absolute inset-x-2 z-[35] flex flex-col items-start gap-1" style={{ bottom: lift ? '5.5rem' : '0.5rem' }}>
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
