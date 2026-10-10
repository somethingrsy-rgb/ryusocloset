import { useState } from 'react'
import { useI18n } from '../i18n'
import { assetUrl } from '../lib/items'
import { decorForPlace, decorLayer, type DecorAction } from '../lib/travelDecor'

const RESPONSES: Record<DecorAction, { ko: string; en: string }> = {
  look: { ko: '가까이서 보니 더 귀엽네요. 이곳만의 작은 보물이에요.', en: 'Even lovelier up close. A little treasure of this place.' },
  water: { ko: '물을 주었어요! 초록 친구가 싱그럽게 반짝여요.', en: 'Watered! Your green friend looks refreshed.' },
  light: { ko: '불빛을 켰어요. 공간이 포근해졌네요.', en: 'The light is on. Everything feels cozier.' },
  rest: { ko: '잠깐 쉬어 가요. 오늘은 서두르지 않아도 괜찮아요.', en: 'Take a little break. There is no rush today.' },
  tea: { ko: '맛있는 간식과 함께 잠깐의 여유를 즐겨요.', en: 'Enjoy a quiet moment with a lovely treat.' },
}

export function TravelDecor({ placeId, blocked, onInteract }: {
  placeId: string
  blocked: boolean
  onInteract: () => void
}) {
  const { lang } = useI18n()
  const [active, setActive] = useState(new Set<string>())
  const [message, setMessage] = useState<{ title: string; body: string } | null>(null)
  return (
    <>
      {decorForPlace(placeId).map((decor) => {
        const { item, action, x, y, width } = decor
        const lit = active.has(item.id)
        const floor = item.group !== 'wall' && item.group !== 'rug'
        const style = {
          left: `${x}%`, top: `${y}%`, width: `${width}%`,
          aspectRatio: `${item.w} / ${item.h}`,
          transform: 'translate(-50%, -100%)', zIndex: decorLayer(decor),
        }
        if (item.group === 'rug') return (
          <img key={item.id} src={assetUrl(item.image)} alt="" draggable={false}
            className="pointer-events-none absolute" style={style} />
        )
        return (
          <button key={item.id} disabled={blocked}
            aria-label={`${item.name[lang]} · ${lang === 'ko' ? '살펴보기' : 'Explore'}`}
            aria-pressed={action === 'light' || action === 'water' ? lit : undefined}
            className={`travel-prop absolute ${floor ? 'travel-prop-floor' : ''} ${lit ? 'travel-prop-active' : ''}`}
            style={style}
            onClick={() => {
              onInteract()
              if (action === 'water' || action === 'light') {
                setActive((previous) => {
                  const next = new Set(previous)
                  if (action === 'light' && lit) next.delete(item.id)
                  else next.add(item.id)
                  return next
                })
              }
              setMessage({
                title: item.name[lang],
                body: action === 'light' && lit
                  ? lang === 'ko' ? '불빛을 껐어요. 조용한 시간을 즐겨요.' : 'The light is off. Enjoy the quiet.'
                  : action === 'water' && lit
                    ? lang === 'ko' ? '오늘 물을 충분히 주었어요. 조금 쉬게 해주세요.' : 'Already watered. Let it rest a little.'
                    : RESPONSES[action][lang],
              })
            }}>
            <img src={assetUrl(item.image)} alt="" draggable={false} className="h-full w-full object-contain" />
            {lit && <span aria-hidden className="travel-prop-effect">{action === 'water' ? '💧' : '✨'}</span>}
            <span className="travel-prop-label">{item.name[lang]}</span>
          </button>
        )
      })}
      {message && !blocked && (
        <div role="status" className="travel-prop-message absolute inset-x-3 bottom-20 z-[120] rounded-2xl border border-white bg-cream p-3 shadow-lg">
          <button aria-label={lang === 'ko' ? '닫기' : 'Close'} onClick={() => setMessage(null)}
            className="float-right flex h-9 w-9 items-center justify-center rounded-full bg-petal">✕</button>
          <p className="m-0 text-sm font-bold text-blush-deep">{message.title}</p>
          <p className="mt-1 mb-0 text-xs leading-relaxed">{message.body}</p>
        </div>
      )}
    </>
  )
}
