import { assetUrl } from '../lib/items'

/** 코인·별·입어보기 아이콘 그림. 글자와 같은 크기(em)로 나오고 글줄에 맞춰 놓인다 */
const base = 'inline-block h-[1.15em] w-[1.15em] shrink-0 select-none align-[-0.2em] object-contain'
const icon = (file: string) =>
  function Icon({ className = '' }: { className?: string }) {
    return <img src={assetUrl(`assets/ui/${file}.webp`)} alt="" aria-hidden draggable={false} className={`${base} ${className}`} />
  }
export const CoinIcon = icon('coin')
export const StarIcon = icon('star')
export const DressIcon = icon('dress')
