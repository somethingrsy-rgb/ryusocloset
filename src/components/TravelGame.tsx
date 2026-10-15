import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { setTravelFull } from '../lib/travelUi'
import { currentAssignment, gameVersion, getGame, subscribeGame, travelTo } from '../lib/game'
import type { Item, Outfit, Tweaks } from '../lib/types'
import { useItemsVersion } from '../lib/useItemsVersion'
import { StarRainWalk } from './StarRainWalk'
import { FarmScene } from './FarmScene'
import { SpeakingGame } from './SpeakingGame'
import { ShopModal } from './ShopModal'
import { useI18n } from '../i18n'
import { OverWorld } from './OverWorld'
import { PILL, PillText } from './pill'
import { TravelScene } from './TravelScene'

export const useGame = () => {
  useSyncExternalStore(subscribeGame, gameVersion)
  return getGame()
}

interface Props {
  initialPlaceId?: string | null
  outfit: Outfit
  tweaks: Tweaks
  /** 찾은 아이템을 옷장에서 입어보러 간다 */
  onWear: (id: string) => void
  /** 농장에서 옷을 바로 입고 벗는다 */
  onToggleItem: (item: Item) => void
}

/** 여행 탭: 넓은 맵(OverWorld)을 걸어다니다가 문에 들어가면 그 장소 장면(TravelScene)으로 */
export function TravelGame({ outfit, tweaks, onWear, onToggleItem, initialPlaceId = null }: Props) {
  const { lang } = useI18n()
  const [starRain, setStarRain] = useState(false)
  const [farm, setFarm] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [shop, setShop] = useState(false)
  const game = useGame()
  const ver = useItemsVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assign = useMemo(currentAssignment, [ver])
  const [scene, setScene] = useState<string | null>(initialPlaceId)

  useEffect(() => { setTravelFull(farm); return () => setTravelFull(false) }, [farm])
  if (starRain) return <StarRainWalk outfit={outfit} tweaks={tweaks} onExit={() => setStarRain(false)} />
  if (farm) return <FarmScene outfit={outfit} tweaks={tweaks} onExit={() => setFarm(false)} onWear={onWear} onToggleItem={onToggleItem} />

  const actionButton = PILL
  const label = (text: string) => <PillText>{text}</PillText>
  return <div className="relative h-full">
    {scene ? <TravelScene paused={speaking} key={scene} placeId={scene} assign={assign} outfit={outfit} tweaks={tweaks} onExit={() => setScene(null)} onWear={onWear} /> : <OverWorld
      paused={speaking} reach={game.reach} chunk={game.chunk} assign={assign} outfit={outfit} tweaks={tweaks}
      actions={<>
        <button className={actionButton} aria-label="한마디 영어" onClick={() => setSpeaking(true)}>{label(lang === 'ko' ? '영어' : 'Talk')}</button>
        <button className={actionButton} aria-label="농장으로" onClick={() => setFarm(true)}>{label(lang === 'ko' ? '농장' : 'Farm')}</button>
        <button className={actionButton} aria-label="상점" onClick={() => setShop(true)}>{label(lang === 'ko' ? '상점' : 'Shop')}</button>
        <button className={actionButton} aria-label="별비 산책" onClick={() => setStarRain(true)}>{label(lang === 'ko' ? '별비' : 'Stars')}</button>
      </>}
      onEnter={(id, chunk) => { travelTo(id, chunk); setScene(id) }}
    />}
    {speaking && <SpeakingGame onClose={() => setSpeaking(false)} />}
    {shop && <ShopModal onClose={() => setShop(false)} onWear={onWear} />}
  </div>
}

