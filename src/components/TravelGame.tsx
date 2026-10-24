import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { startBgm, stopBgm } from '../lib/sound'
import { currentAssignment, gameVersion, getGame, subscribeGame, travelTo } from '../lib/game'
import type { Outfit, Tweaks } from '../lib/types'
import { useItemsVersion } from '../lib/useItemsVersion'
import { StarRainWalk } from './StarRainWalk'
import { RunnerGame } from './RunnerGame'
import { JumpPuzzle } from './JumpPuzzle'
import { MathGame } from './MathGame'
import { SpeakingGame } from './SpeakingGame'
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
  /** 수학·영어 같은 전체 화면 놀이가 열려 있으면 true (아래 여행 도감을 숨긴다) */
  onFull?: (full: boolean) => void
  /** 장소 안에서 "방 꾸미기"를 누르면 그 테마로 내 방을 연다 */
  onDecorate?: (placeId: string) => void
}

/** 여행 탭: 넓은 맵(OverWorld)을 걸어다니다가 문에 들어가면 그 장소 장면(TravelScene)으로 */
export function TravelGame({ outfit, tweaks, onWear, onFull, onDecorate, initialPlaceId = null }: Props) {
  const { lang } = useI18n()
  const [starRain, setStarRain] = useState(false)
  const [runner, setRunner] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [math, setMath] = useState(false)
  const [jump, setJump] = useState(false)
  useEffect(() => { onFull?.(math || speaking || jump || runner); return () => onFull?.(false) }, [math, speaking, jump, runner, onFull])
  const game = useGame()
  const ver = useItemsVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assign = useMemo(currentAssignment, [ver])
  const [scene, setScene] = useState<string | null>(initialPlaceId)
  // 마을과 집 안에서는 배경 음악이 이어지고, 게임 화면(별비·수학·점프·영어)에서는 끈다
  const walking = !starRain && !runner && !math && !jump && !speaking
  useEffect(() => { if (!walking) return; startBgm('walk'); return stopBgm }, [walking])

  if (runner) return <RunnerGame outfit={outfit} tweaks={tweaks} onExit={() => setRunner(false)} />
  if (starRain) return <StarRainWalk outfit={outfit} tweaks={tweaks} onExit={() => setStarRain(false)} />

  const actionButton = PILL
  const label = (text: string) => <PillText>{text}</PillText>
  return <div className="relative h-full">
    {scene ? <TravelScene paused={speaking} key={scene} placeId={scene} assign={assign} outfit={outfit} tweaks={tweaks} onExit={() => setScene(null)} onWear={onWear} onDecorate={onDecorate} /> : <OverWorld
      paused={speaking} reach={game.reach} chunk={game.chunk} assign={assign} outfit={outfit} tweaks={tweaks}
      actions={<>
        <button className={actionButton} aria-label="한마디 영어" onClick={() => setSpeaking(true)}>{label(lang === 'ko' ? '영어' : 'Talk')}</button>
        <button className={actionButton} aria-label="별비 산책" onClick={() => setStarRain(true)}>{label(lang === 'ko' ? '별비' : 'Stars')}</button>
        <button className={actionButton} aria-label="달려라 아바타" onClick={() => setRunner(true)}>{label(lang === 'ko' ? '달리기' : 'Run')}</button>
        <button className={actionButton} aria-label="수학 놀이터" onClick={() => setMath(true)}>{label(lang === 'ko' ? '수학' : 'Math')}</button>
        <button className={actionButton} aria-label="점프 퍼즐" onClick={() => setJump(true)}>{label(lang === 'ko' ? '점프' : 'Jump')}</button>
      </>}
      onEnter={(id, chunk) => { travelTo(id, chunk); setScene(id) }}
    />}
    {speaking && <SpeakingGame onClose={() => setSpeaking(false)} />}
    {math && <MathGame onClose={() => setMath(false)} />}
    {jump && <JumpPuzzle onClose={() => setJump(false)} />}
  </div>
}

