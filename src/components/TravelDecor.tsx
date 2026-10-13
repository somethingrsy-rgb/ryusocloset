import { useI18n } from '../i18n'
import { assetUrl } from '../lib/items'
import { decorForPlace, decorLayer } from '../lib/travelDecor'

/** 장소 안의 가구·소품: 보이기만 하고 누를 수 없다 (눌러서 멘트가 나오던 기능은 없앴다) */
export function TravelDecor({ placeId }: { placeId: string }) {
  const { lang } = useI18n()
  return (
    <>
      {decorForPlace(placeId).map((decor) => {
        const { item, x, y, width } = decor
        const floor = item.group !== 'wall' && item.group !== 'rug'
        return (
          <div key={item.id} aria-label={item.name[lang]} role="img"
            className={`travel-prop pointer-events-none absolute ${floor ? 'travel-prop-floor' : ''}`}
            style={{ left: `${x}%`, top: `${y}%`, width: `${width}%`, aspectRatio: `${item.w} / ${item.h}`, transform: 'translate(-50%, -100%)', zIndex: decorLayer(decor) }}>
            <img src={assetUrl(item.image)} alt="" draggable={false} className="h-full w-full object-contain" />
          </div>
        )
      })}
    </>
  )
}
