/**
 * 같이 놀기(멀티플레이어) 단추와 채팅 칸. 앱 화면 왼쪽에 늘 하나(App 이 그린다):
 * 한 번 들어가면 어느 탭에 있든 계속 같이 놀기 중이고 채팅도 계속된다. 채팅 칸을 닫아 둬도 새 말은 단추 옆에 잠깐 뜬다.
 * Firebase 설정이 없으면(지금의 배포처럼) 아무것도 그리지 않는다 → 기존 화면 그대로.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { listen, speechSupported } from '../lib/mp/speech'
import { getAvatar } from '../lib/avatars'
import { multiplayerAvailable } from '../lib/mp/config'
import { MAX_CHAT, MAX_NAME, MAX_PLAYERS } from '../lib/mp/core'
import { getMp, joinMp, leaveMp, savedName, say, setLook, subscribeMp } from '../lib/mp/session'
import type { Outfit } from '../lib/types'

export function MultiplayerBar({ outfit }: { outfit: Outfit }) {
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
      if (t) { say(t); setText('') }
      else setMicNote(err === 'not-allowed' || err === 'service-not-allowed' ? '마이크를 쓸 수 있게 허락해 주세요' : '잘 못 들었어요. 다시 말해 볼까요?')
    })
  }
  // 채팅 칸을 닫아 둔 동안 새 말(남이 한 말)은 단추 옆에 6초 보여 준다
  const [, tick] = useState(0)
  const last = mp.chat[mp.chat.length - 1]
  const peek = !open && mp.status === 'on' && last && last.uid !== mp.uid && Date.now() - last.t < 6000 ? last : null
  useEffect(() => { if (!peek) return; const t = setTimeout(() => tick((n) => n + 1), 6100 - (Date.now() - peek.t)); return () => clearTimeout(t) }, [peek])
  const look = { avatar: getAvatar().id, outfit: outfit as Record<string, string> }
  const lookKey = JSON.stringify(look)
  // 옷을 갈아입으면 다른 사람 화면에도
  useEffect(() => { if (mp.status === 'on') setLook(JSON.parse(lookKey)) }, [lookKey, mp.status])
  if (!multiplayerAvailable) return null
  const on = mp.status === 'on'
  const n = Object.keys(mp.players).length
  const btn = 'h-9 rounded-full px-3 text-sm font-black shadow'
  return (
    // 위쪽 단추 줄(폰에서는 두 줄)과 겹치지 않게 조금 아래 왼쪽에 둔다
    <div className="pointer-events-none absolute left-2 z-[60] flex w-[min(15rem,calc(100%-1rem))] flex-col items-start gap-1.5" style={{ top: 'max(22%, 7rem)' }}>
      <button aria-label="같이 놀기" onClick={() => setOpen((o) => !o)} className={`pointer-events-auto ${btn} ${on ? 'bg-[#7a3d8f] text-white' : 'bg-white/95 text-[#7a3d8f]'}`}>
        👥 {on ? `${n}/${MAX_PLAYERS}` : '같이 놀기'}
      </button>
      {peek && <p className="pointer-events-none m-0 max-w-full rounded-2xl bg-white/95 px-2.5 py-1 text-xs font-bold text-[#6b4b52] shadow"><b className="text-[#7a3d8f]">{peek.name}</b> {peek.text}</p>}
      {open && !on && (
        <div className="pointer-events-auto flex w-full flex-col gap-2 rounded-2xl bg-white/95 p-2.5 shadow-lg">
          <label className="text-xs font-bold text-[#6b4b52]">닉네임
            <input value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} placeholder="이름" className="mt-1 h-9 w-full rounded-xl border border-[#f0c6cd] px-2 text-sm" />
          </label>
          <button disabled={mp.status === 'connecting' || !name.trim()} onClick={() => joinMp(name, look)} className={`${btn} bg-[#ff8fab] text-white disabled:opacity-50`}>
            {mp.status === 'connecting' ? '연결하는 중…' : '들어가기'}
          </button>
          {mp.status === 'full' && <p className="m-0 text-xs font-bold text-[#d0587a]">지금은 {MAX_PLAYERS}명이 꽉 찼어요. 조금 뒤에 다시 해 봐요</p>}
          {mp.status === 'error' && <p className="m-0 text-xs font-bold text-[#d0587a]">연결하지 못했어요 · {mp.error}</p>}
        </div>
      )}
      {on && (
        <div className="pointer-events-auto flex w-full flex-col gap-1.5 rounded-2xl bg-white/90 p-2 shadow-lg">
          <ul className="m-0 flex max-h-28 list-none flex-col gap-0.5 overflow-y-auto p-0 text-xs">
            {mp.chat.slice(-6).map((c) => <li key={c.id} className="leading-snug"><b className={c.uid === mp.uid ? 'text-[#c04a5a]' : 'text-[#7a3d8f]'}>{c.name}</b> {c.text}</li>)}
            {!mp.chat.length && <li className="text-black/40">같이 노는 친구들과 이야기해요</li>}
          </ul>
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); say(text); setText('') }}>
            {speechSupported && (
              <button type="button" aria-label={hearing ? '듣는 중 · 누르면 멈춰요' : '말로 채팅하기'} onClick={mic}
                className={`h-8 w-9 shrink-0 rounded-xl text-base shadow ${hearing ? 'animate-pulse bg-[#ff5c8a] text-white' : 'bg-[#ffe4ec]'}`}>🎤</button>
            )}
            <input aria-label="채팅" value={text} maxLength={MAX_CHAT} onChange={(e) => setText(e.target.value)} placeholder={hearing ? '듣고 있어요… 말해 봐요' : speechSupported ? '🎤 누르고 말하기' : '말하기…'} className="h-8 min-w-0 flex-1 rounded-xl border border-[#f0c6cd] px-2 text-sm" />
            <button className="h-8 rounded-xl bg-[#ff8fab] px-2 text-xs font-black text-white">보내기</button>
          </form>
          {micNote && <p className="m-0 text-[11px] font-bold text-[#d0587a]">{micNote}</p>}
          <button onClick={() => { leaveMp(); setOpen(false) }} className="self-end text-[11px] font-bold text-black/50">나가기</button>
        </div>
      )}
    </div>
  )
}
