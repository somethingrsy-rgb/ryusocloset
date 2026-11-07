import { useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { CROPS, getFarm, orderCrop, subscribeFarm, type FarmAction } from '../lib/farm'
import { assetUrl } from '../lib/items'
import { CoinIcon } from './Icons'
import { Modal } from './Modal'

/** 그림 파일이 없으면 이모지로 대신 보여 준다 (그림을 나중에 채워도 코드는 그대로) */
export function FarmImg({ name, emoji, className, style, alt = '' }: { name: string; emoji: string; className?: string; style?: React.CSSProperties; alt?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem', lineHeight: 1 }}>{emoji}</span>
  return <img src={assetUrl(`assets/farm/${name}.webp`)} alt={alt} className={className} style={style} draggable={false} onError={() => setFailed(true)} />
}

/** 노점: 주민의 부탁(작물 두 개 전달)과 바구니 팔기. 2D 농장과 3D 농장이 같이 쓴다 */
export function FarmStall({ apply, notice, onClose }: { apply: (a: FarmAction) => boolean; notice: string; onClose: () => void }) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const order = orderCrop(farm)
  const btn = 'min-h-11 rounded-2xl px-3 py-2 text-sm font-bold'
  return (
    <Modal title={`🧺 ${ko ? '노점' : 'Market stall'}`} onClose={onClose}>
      <div className="rounded-2xl bg-petal/60 p-3">
        <h3 className="m-0 text-sm font-bold">🐰 {ko ? '주민의 부탁' : 'Resident request'} · +12 <CoinIcon /></h3>
        <p lang="en" className="mb-1 text-base font-bold">Can I have two {order.plural}?</p>
        <p className="mt-0 text-xs">{ko ? `${order.ko} 두 개를 줄 수 있나요?` : `Give the resident two ${order.plural}.`}</p>
        <button disabled={farm.inventory[order.id] < 2} className={`${btn} w-full bg-blush text-white disabled:opacity-40`} onClick={() => apply({ type: 'deliver' })}>
          {ko ? '전달하기' : 'Deliver'} · {farm.inventory[order.id]}/2
        </button>
      </div>
      <h3 className="mt-3 mb-1 text-sm font-bold">🧺 {ko ? '바구니 팔기' : 'Sell from basket'}</h3>
      <div className="grid grid-cols-3 gap-2">
        {CROPS.map((c) => (
          <div key={c.id} className="text-center">
            <FarmImg name={`harvest_${c.id}`} emoji={c.emoji} className="mx-auto h-14 w-14 object-contain" />
            <p className="my-1 text-sm font-bold">{c[lang]} × {farm.inventory[c.id]}</p>
            <button disabled={!farm.inventory[c.id]} className={`${btn} w-full bg-petal disabled:opacity-40`} onClick={() => apply({ type: 'sell', crop: c.id })}>{ko ? '팔기' : 'Sell'} +{c.price} <CoinIcon /></button>
          </div>
        ))}
      </div>
      <p role="status" className="mt-2 min-h-5 text-xs font-bold">{notice}</p>
    </Modal>
  )
}
