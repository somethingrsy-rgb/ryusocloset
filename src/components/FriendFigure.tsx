import { CALL_ANIMALS } from '../lib/animalCalls'
import { guestLook } from '../lib/guestLooks'
import { assetUrl } from '../lib/items'
import { guestAvatar } from '../lib/party'
import { FigureLayers } from './FigureLayers'

/**
 * 같이 하는 친구 한 명의 그림: 동물 친구는 서 있는 그림(손 흔들 때는 wave), 아바타 친구는 고른 옷을 입은 아바타.
 * 부모는 동물 그림 칸(정사각형, 칸 아래쪽이 발)이다. 아바타는 그 칸 아래쪽에 발을 맞추고, 너비는 avatarW 배(칸 너비 기준)로 그린다.
 */
export function FriendFigure({ g, wave = false, flip = false, avatarW, className = '' }: {
  g: number
  /** 손 흔드는 그림(동물 친구만) */
  wave?: boolean
  flip?: boolean
  /** 아바타 친구 너비 ÷ 칸 너비: 내 아바타와 같은 크기가 되게 */
  avatarW: number
  className?: string
}) {
  const av = guestAvatar(g)
  if (av) {
    const w = avatarW * 100, h = w * 1.5
    return (
      <span className={`absolute block ${className}`} style={{ width: `${w}%`, height: `${h}%`, left: `${(100 - w) / 2}%`, bottom: `${-h * (1 - 1504 / 1536)}%`, transform: flip ? 'scaleX(-1)' : undefined }}>
        <FigureLayers outfit={guestLook(av.id)} avatar={av} animate={false} />
      </span>
    )
  }
  const a = CALL_ANIMALS[g]
  if (!a) return null
  // 서 있는 그림·손 흔드는 그림을 겹쳐 두고 보이기만 바꾼다(그림을 바꿔 끼우면 새로 읽는 동안 잠깐 비었다)
  return <>
    {(['stand', 'wave'] as const).map((pose) => (
      <img key={pose} src={assetUrl(`cafe/stand/${a.img}_${pose}.webp`)} alt="" draggable={false} className={`absolute inset-0 h-full w-full object-contain ${className}`}
        style={{ visibility: (pose === 'wave') === wave ? 'visible' : 'hidden', transform: flip ? 'scaleX(-1)' : undefined }} />
    ))}
  </>
}
