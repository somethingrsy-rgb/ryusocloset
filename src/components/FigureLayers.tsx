import { BASE_LAYERS, ITEM_BY_ID, assetUrl } from '../lib/items'
import { BASE_Z, HAIR_FRONT_Z } from '../lib/layers'
import { wornItems } from '../lib/outfit'
import type { Outfit } from '../lib/types'

/**
 * 아바타 + 옷 레이어 (부모는 position:relative 이고 1024:1536 비율이어야 한다).
 * 레이어(아래→위): 뒷머리 < 몸(신발 착용 시 맨발 몸) < 슬리퍼(신발 미착용 시) < 신발 < 하의 < 상의 < 원피스 < 아우터 < 앞머리 < 액세서리 < 가방
 * 모든 PNG 는 같은 1024x1536 캔버스라서 inset-0 으로 그대로 겹치면 정렬된다.
 */
export function FigureLayers({ outfit, animate = true }: { outfit: Outfit; animate?: boolean }) {
  const items = wornItems(outfit, ITEM_BY_ID)
  const body = outfit.shoes ? BASE_LAYERS.bodyBarefoot : BASE_LAYERS.body
  return (
    <>
      <img src={BASE_LAYERS.hairBack} alt="" className="layer" style={{ zIndex: BASE_Z.hairBack }} draggable={false} />
      <img src={body} alt="" className="layer" style={{ zIndex: BASE_Z.body }} draggable={false} />
      {!outfit.shoes && (
        <img src={BASE_LAYERS.slippers} alt="" className="layer" style={{ zIndex: BASE_Z.slippers }} draggable={false} />
      )}
      {items.map((it) => (
        <img
          key={it.id}
          src={assetUrl(it.image)}
          alt=""
          className={`layer ${animate ? 'item-in' : ''}`}
          style={{ zIndex: it.zIndex }}
          draggable={false}
        />
      ))}
      <img src={BASE_LAYERS.hairFront} alt="" className="layer" style={{ zIndex: HAIR_FRONT_Z }} draggable={false} />
    </>
  )
}
