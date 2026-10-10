import { useMemo, useState, useSyncExternalStore } from 'react'
import { currentAssignment, gameVersion, getGame, subscribeGame, travelTo } from '../lib/game'
import type { Outfit, Tweaks } from '../lib/types'
import { useItemsVersion } from '../lib/useItemsVersion'
import { SpeakingGame } from './SpeakingGame'
import { useI18n } from '../i18n'
import { OverWorld } from './OverWorld'
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
}

/** 여행 탭: 넓은 맵(OverWorld)을 걸어다니다가 문에 들어가면 그 장소 장면(TravelScene)으로 */
export function TravelGame({ outfit, tweaks, onWear, initialPlaceId = null }: Props) {
  const { lang } = useI18n()
  const [speaking, setSpeaking] = useState(false)
  const game = useGame()
  const ver = useItemsVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assign = useMemo(currentAssignment, [ver])
  const [scene, setScene] = useState<string | null>(initialPlaceId)

  return <div className="relative h-full">
    {scene ? <TravelScene paused={speaking} key={scene} placeId={scene} assign={assign} outfit={outfit} tweaks={tweaks} onExit={() => setScene(null)} onWear={onWear} /> : <OverWorld
      paused={speaking} reach={game.reach} chunk={game.chunk} assign={assign} outfit={outfit} tweaks={tweaks}
      onEnter={(id, chunk) => { travelTo(id, chunk); setScene(id) }}
    />}
    {!scene && <button className="absolute top-16 right-3 z-30 min-h-12 rounded-full bg-blush px-4 text-sm font-bold text-white shadow-lg" onClick={() => setSpeaking(true)}>🎤 {lang === 'ko' ? '한마디 영어' : 'Speaking practice'}</button>}
    {speaking && <SpeakingGame onClose={() => setSpeaking(false)} />}
  </div>
}
