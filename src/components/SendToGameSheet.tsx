import { useState } from 'react'
import { useI18n } from '../i18n'
import { getGame, PLACES } from '../lib/game'
import type { RoomState } from '../lib/roomTypes'
import { getTravelRoom, removeTravelRoom, saveTravelRoom } from '../lib/travelRooms'
import { Modal } from './Modal'

export function SendToGameSheet({ scene, room, onClose, onApplied }: {
  scene: 'room' | 'camp'; room: RoomState; onClose: () => void; onApplied: (id: string) => void
}) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const [place, setPlace] = useState(getGame().at)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const customized = !!getTravelRoom(place)
  return <Modal title={ko ? '게임에 보내기' : 'Send to game'} onClose={onClose}>
    <p className="my-3 text-sm">{ko ? `벽지·바닥·소품 ${room.items.length}개를 게임 장소에 복사해요. 이동, 주민 대화와 영어 퀴즈도 그대로 즐길 수 있어요.` : `Copy your walls, floor and ${room.items.length} furnishings into a game destination. Walk, talk to residents and play English quizzes there.`}</p>
    <label className="block text-sm font-bold" htmlFor="game-room-place">{ko ? '적용할 장소' : 'Destination'}</label>
    <select id="game-room-place" value={place} onChange={e => { setPlace(e.target.value); setError('') }} className="my-2 min-h-12 w-full rounded-xl border border-black/15 bg-white px-3">
      {PLACES.map(p => <option key={p.id} value={p.id}>{p.icon} {p[lang]}</option>)}
    </select>
    <p className="mb-4 text-sm text-black/60">{customized ? (ko ? '이 장소에 보낸 방을 현재 모습으로 업데이트해요.' : 'Update the room already sent here.') : (ko ? '꾸민 모습은 저장돼요. 나중에 방을 바꾸면 다시 보내주세요.' : 'Your design is saved. Send it again after editing your room.')}</p>
    <button className="min-h-12 w-full rounded-xl bg-blush px-4 font-bold text-white" onClick={() => {
      if (saveTravelRoom(place, scene, room)) onApplied(place)
      else setError(ko ? '저장하지 못했어요. 저장 공간을 확인하고 다시 시도해주세요.' : 'Could not save. Check available storage and try again.')
    }}>{ko ? '게임에 보내고 들어가기' : 'Send and enter'}</button>
    {customized && <button key={revision} className="mt-3 min-h-12 w-full rounded-xl bg-petal px-4 font-bold" onClick={() => {
      if (removeTravelRoom(place)) { setRevision(n => n + 1); setError('') }
      else setError(ko ? '변경을 저장하지 못했어요.' : 'Could not save the change.')
    }}>{ko ? '기본 게임 배경으로 되돌리기' : 'Restore original game room'}</button>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </Modal>
}
