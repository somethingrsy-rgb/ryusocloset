import type { ReactNode, RefObject } from 'react'
import { bgToCss, type Background } from '../lib/backgrounds'
import { BASE_LAYERS, ITEM_BY_ID, assetUrl } from '../lib/items'
import { CANVAS_H, CANVAS_W, HAIR_FRONT_Z } from '../lib/layers'
import { wornItems } from '../lib/outfit'
import type { Outfit } from '../lib/types'

interface Props {
  outfit: Outfit
  bg: Background
  figureRef: RefObject<HTMLDivElement | null>
  children?: ReactNode
}

/**
 * 아바타 + 옷 레이어 합성 무대.
 * 레이어(아래→위): 몸(신발 착용 시 맨발 몸) < 신발 < 하의 < 상의 < 원피스 < 아우터 < 앞머리 < 액세서리 < 가방
 * 모든 PNG 는 같은 851x1280 캔버스라서 inset-0 으로 그대로 겹치면 정렬된다.
 */
export function Stage({ outfit, bg, figureRef, children }: Props) {
  const items = wornItems(outfit, ITEM_BY_ID)
  const body = outfit.shoes ? BASE_LAYERS.bodyBarefoot : BASE_LAYERS.body
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-3xl shadow-inner ring-1 ring-black/5"
      style={{ background: bgToCss(bg), containerType: 'size' }}
    >
      <div className="absolute inset-0 flex items-end justify-center pb-[3cqh]">
        <div
          ref={figureRef}
          className="sticker relative"
          style={{
            width: `min(calc(92cqh * ${CANVAS_W / CANVAS_H}), 92cqw)`,
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          }}
        >
          <img src={body} alt="" className="layer" style={{ zIndex: 0 }} draggable={false} />
          {items.map((it) => (
            <img
              key={it.id}
              src={assetUrl(it.image)}
              alt=""
              className="layer item-in"
              style={{ zIndex: it.zIndex }}
              draggable={false}
            />
          ))}
          <img src={BASE_LAYERS.hairFront} alt="" className="layer" style={{ zIndex: HAIR_FRONT_Z }} draggable={false} />
        </div>
      </div>
      {children}
    </div>
  )
}
