import type { Avatar, Hairstyle } from '../lib/avatars'
import { baseFiles } from '../lib/avatars'
import { assetUrl } from '../lib/items'

/** 아바타 얼굴 쪽 정사각형 미리보기 (몸 + 머리 레이어를 겹쳐서 잘라 보여준다) */
export function AvatarHead({ avatar, style, className = 'h-24 w-24' }: { avatar: Avatar; style?: Hairstyle; className?: string }) {
  const f = baseFiles(avatar, style)
  const layer = 'absolute max-w-none'
  const box = { width: `${(1024 / 760) * 100}%`, left: `${(-132 / 760) * 100}%`, top: `${(-20 / 760) * 100}%` }
  return (
    <span className={`relative block overflow-hidden rounded-xl bg-white/70 ${className}`} aria-hidden>
      <img src={assetUrl(f.body)} alt="" className={layer} style={box} draggable={false} />
      <img src={assetUrl(f.hairFront)} alt="" className={layer} style={box} draggable={false} />
    </span>
  )
}
