import { useMemo, useState, useSyncExternalStore } from 'react'
import { currentAssignment, gameVersion, getGame, subscribeGame, travelTo } from '../lib/game'
import type { Outfit, Tweaks } from '../lib/types'
import { useItemsVersion } from '../lib/useItemsVersion'
import { StarRainWalk } from './StarRainWalk'
import { FarmScene } from './FarmScene'
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
  const [starRain, setStarRain] = useState(false)
  const [farm, setFarm] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const game = useGame()
  const ver = useItemsVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assign = useMemo(currentAssignment, [ver])
  const [scene, setScene] = useState<string | null>(initialPlaceId)

  if (starRain) return <StarRainWalk outfit={outfit} tweaks={tweaks} onExit={() => setStarRain(false)} />
  if (farm) return <FarmScene onExit={() => setFarm(false)} />

  // 거리(m) 표시와 같은 모양: 흰색 알약, 누르는 동안 민트색. (버튼에는 전역 font: inherit 때문에 글자 크기 클래스가 먹지 않아 안쪽 span 에 건다)
  const actionButton = 'flex h-11 shrink-0 items-center rounded-full bg-white/90 px-2 shadow-sm ring-1 ring-black/5 transition-colors active:bg-[#a9dcc8]'
  const label = (text: string) => <span className="text-xs font-bold">{text}</span>
  return <div className="relative h-full">
    {scene ? <TravelScene paused={speaking} key={scene} placeId={scene} assign={assign} outfit={outfit} tweaks={tweaks} onExit={() => setScene(null)} onWear={onWear} /> : <OverWorld
      paused={speaking} reach={game.reach} chunk={game.chunk} assign={assign} outfit={outfit} tweaks={tweaks}
      actions={<>
        <button className={actionButton} aria-label="한마디 영어" onClick={() => setSpeaking(true)}>{label(lang === 'ko' ? '영어' : 'Talk')}</button>
        <button className={actionButton} aria-label="농장으로" onClick={() => setFarm(true)}>{label(lang === 'ko' ? '농장' : 'Farm')}</button>
        <button className={actionButton} aria-label="별비 산책" onClick={() => setStarRain(true)}>{label(lang === 'ko' ? '별비' : 'Stars')}</button>
      </>}
      onEnter={(id, chunk) => { travelTo(id, chunk); setScene(id) }}
    />}
    {speaking && <SpeakingGame onClose={() => setSpeaking(false)} />}
  </div>
}

