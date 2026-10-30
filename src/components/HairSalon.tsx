import { useI18n } from '../i18n'
import { avatarName, getHairstyle, setHairstyle } from '../lib/avatars'
import { useAvatar } from '../lib/useAvatar'
import { AvatarHead } from './AvatarHead'
import { Modal } from './Modal'

/** 헤어숍: 지금 아바타의 머리 모양을 고른다 */
export function HairSalon({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const avatar = useAvatar()
  const current = getHairstyle(avatar)
  return (
    <Modal title={`💇 ${ko ? '헤어숍' : 'Hair salon'}`} onClose={onClose}>
      <p className="mb-3 text-sm">{ko ? `${avatarName(avatar)}의 머리 모양을 골라요` : `Pick a hairstyle for ${avatarName(avatar, 'en')}`}</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={ko ? '머리 모양' : 'Hairstyle'}>
        {avatar.hairstyles.map((h) => (
          <button
            key={h.id}
            role="radio"
            aria-checked={h.id === current.id}
            onClick={() => setHairstyle(avatar, h.id)}
            className={`flex flex-col items-center gap-1 rounded-2xl bg-petal/50 p-2 font-bold ${h.id === current.id ? 'ring-2 ring-blush' : ''}`}
          >
            <AvatarHead avatar={avatar} style={h} className="h-28 w-28" />
            <span className="text-sm">{h.name[lang]}{h.id === current.id ? ' ✓' : ''}</span>
          </button>
        ))}
      </div>
      {avatar.hairstyles.length < 2 && (
        <p className="mt-3 text-xs text-cocoa-soft">{ko ? '이 아바타는 아직 머리 모양이 하나예요. 유하로 바꾸면 여러 머리를 고를 수 있어요.' : 'This avatar has only one hairstyle so far. Switch to Yuha to choose from several.'}</p>
      )}
    </Modal>
  )
}
