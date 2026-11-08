import { assetUrl } from '../lib/items'

/** 반짝이 그림(이모지 ✨ 대신). 글자 크기(1em)에 맞춰 그린다 */
export const SPARKLE_IMG = 'fx/sparkle.webp'
export function Sparkle({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <img src={assetUrl(SPARKLE_IMG)} alt="" aria-hidden draggable={false} className={`inline-block h-[1em] w-[1em] object-contain align-[-0.1em] ${className}`} style={style} />
}
