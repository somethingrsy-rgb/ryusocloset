import { BASE_LAYERS, ITEM_BY_ID, assetUrl } from '../lib/items'
import { HAIR_FRONT_Z } from '../lib/layers'
import { wornItems } from '../lib/outfit'
import { cssTransform, effectiveZ } from '../lib/tweaks'
import type { Outfit, Tweaks } from '../lib/types'

/**
 * 아바타 + 옷 레이어 (부모는 position:relative 이고 1024:1536 비율이어야 한다).
 * 레이어(아래→위): 몸(머리·슬리퍼 포함, 신발 착용 시 맨발 몸) < 신발 < 하의 < 상의 < 원피스 < 아우터 < 앞머리 < 액세서리 < 가방
 * 모든 PNG 는 같은 1024x1536 캔버스라서 inset-0 으로 그대로 겹치면 정렬된다.
 * 옷마다 tweaks 로 위치·크기를 조절할 수 있다 (변환은 입장 애니메이션과 겹치지 않게 바깥 래퍼에 건다).
 */
export function FigureLayers({
  outfit,
  tweaks = {},
  animate = true,
}: {
  outfit: Outfit
  tweaks?: Tweaks
  animate?: boolean
}) {
  const items = wornItems(outfit, ITEM_BY_ID, tweaks)
  const body = outfit.shoes ? BASE_LAYERS.bodyBarefoot : BASE_LAYERS.body
  return (
    <>
      <img src={body} alt="" className="layer" style={{ zIndex: 0 }} draggable={false} />
      {items.map((it) => {
        const t = tweaks[it.category]
        return (
          <div key={it.id} className="layer" style={{ zIndex: effectiveZ(it.zIndex, t), ...(t ? cssTransform(it, t) : null) }}>
            <img
              src={assetUrl(it.image)}
              alt=""
              className={`layer ${animate ? 'item-in' : ''}`}
              draggable={false}
            />
          </div>
        )
      })}
      <img src={BASE_LAYERS.hairFront} alt="" className="layer" style={{ zIndex: HAIR_FRONT_Z }} draggable={false} />
    </>
  )
}
