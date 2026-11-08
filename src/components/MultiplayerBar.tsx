/**
 * 같이 놀기(멀티플레이어) 단추와 채팅 칸. 3D 카페·농장·산책 화면 왼쪽에 얹는다.
 * Firebase 설정이 없으면(지금의 배포처럼) 아무것도 그리지 않는다 → 기존 화면 그대로.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getAvatar } from '../lib/avatars'
import { multiplayerAvailable } from '../lib/mp/config'
import { MAX_CHAT, MAX_NAME, MAX_PLAYERS, type Room } from '../lib/mp/core'
import { getMp, joinRoom, leaveRoom, savedName, say, setLook, subscribeMp } from '../lib/mp/session'
import type { Outfit } from '../lib/types'

export function MultiplayerBar({ room, outfit }: { room: Room; outfit: Outfit }) {
  const mp = useSyncExternalStore(subscribeMp, getMp)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(savedName)
  const [text, setText] = useState('')
  const here = mp.room === room
  const look = { avatar: getAvatar().id, outfit: outfit as Record<string, string> }
  const lookKey = JSON.stringify(look)
  // 옷을 갈아입으면 다른 사람 화면에도
  useEffect(() => { if (here && mp.status === 'on') setLook(JSON.parse(lookKey)) }, [lookKey, here, mp.status])
  // 이 화면을 떠나면 방에서 나간다
  useEffect(() => () => { if (getMp().room === room) leaveRoom() }, [room])
  if (!multiplayerAvailable) return null
  const on = here && mp.status === 'on'
  const n = Object.keys(mp.players).length
  const btn = 'h-9 rounded-full px-3 text-sm font-black shadow'
  return (
    <div className="pointer-events-none absolute top-14 left-2 z-20 flex w-[min(17rem,calc(100%-1rem))] flex-col items-start gap-1.5">
      <button aria-label="같이 놀기" onClick={() => setOpen((o) => !o)} className={`pointer-events-auto ${btn} ${on ? 'bg-[#7a3d8f] text-white' : 'bg-white/95 text-[#7a3d8f]'}`}>
        👥 {on ? `${n}/${MAX_PLAYERS}` : '같이 놀기'}
      </button>
      {open && !on && (
        <div className="pointer-events-auto flex w-full flex-col gap-2 rounded-2xl bg-white/95 p-2.5 shadow-lg">
          <label className="text-xs font-bold text-[#6b4b52]">닉네임
            <input value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} placeholder="이름" className="mt-1 h-9 w-full rounded-xl border border-[#f0c6cd] px-2 text-sm" />
          </label>
          <button disabled={mp.status === 'connecting' || !name.trim()} onClick={() => joinRoom(room, name, look)} className={`${btn} bg-[#ff8fab] text-white disabled:opacity-50`}>
            {mp.status === 'connecting' && here ? '연결하는 중…' : '들어가기'}
          </button>
          {here && mp.status === 'full' && <p className="m-0 text-xs font-bold text-[#d0587a]">지금은 {MAX_PLAYERS}명이 꽉 찼어요. 조금 뒤에 다시 해 봐요</p>}
          {here && mp.status === 'error' && <p className="m-0 text-xs font-bold text-[#d0587a]">연결하지 못했어요 · {mp.error}</p>}
        </div>
      )}
      {on && (
        <div className="pointer-events-auto flex w-full flex-col gap-1.5 rounded-2xl bg-white/90 p-2 shadow-lg">
          <ul className="m-0 flex max-h-28 list-none flex-col gap-0.5 overflow-y-auto p-0 text-xs">
            {mp.chat.slice(-6).map((c) => <li key={c.id} className="leading-snug"><b className={c.uid === mp.uid ? 'text-[#c04a5a]' : 'text-[#7a3d8f]'}>{c.name}</b> {c.text}</li>)}
            {!mp.chat.length && <li className="text-black/40">같이 노는 친구들과 이야기해요</li>}
          </ul>
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); say(text); setText('') }}>
            <input aria-label="채팅" value={text} maxLength={MAX_CHAT} onChange={(e) => setText(e.target.value)} placeholder="말하기…" className="h-8 min-w-0 flex-1 rounded-xl border border-[#f0c6cd] px-2 text-sm" />
            <button className="h-8 rounded-xl bg-[#ff8fab] px-2 text-xs font-black text-white">보내기</button>
          </form>
          <button onClick={() => { leaveRoom(); setOpen(false) }} className="self-end text-[11px] font-bold text-black/50">나가기</button>
        </div>
      )}
    </div>
  )
}
