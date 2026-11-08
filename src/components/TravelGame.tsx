import { Suspense, lazy, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { takeWalkNext } from '../lib/farmCafeLink'
import { startBgm, stopBgm } from '../lib/sound'
import { currentAssignment, gameVersion, getGame, subscribeGame, travelTo } from '../lib/game'
import type { Outfit, Tweaks } from '../lib/types'
import { useItemsVersion } from '../lib/useItemsVersion'
import { useI18n } from '../i18n'
import { OverWorld } from './OverWorld'
import { PILL, PillText } from './pill'
import { TravelScene } from './TravelScene'

// 놀이 화면(축구·달리기·별비·점프·수학·영어)은 처음 열 때 받는다
const StarRainWalk = lazy(() => import('./StarRainWalk').then((m) => ({ default: m.StarRainWalk })))
const RunnerGame = lazy(() => import('./RunnerGame').then((m) => ({ default: m.RunnerGame })))
const JumpPuzzle = lazy(() => import('./JumpPuzzle').then((m) => ({ default: m.JumpPuzzle })))
const FlagGame = lazy(() => import('./FlagGame').then((m) => ({ default: m.FlagGame })))
const SoccerGame = lazy(() => import('./SoccerGame').then((m) => ({ default: m.SoccerGame })))
// 3D 산책(시험판): three.js 가 커서 누를 때만 받는다
const Walk3D = lazy(() => import('./Walk3D').then((m) => ({ default: m.Walk3D })))
const MathGame = lazy(() => import('./MathGame').then((m) => ({ default: m.MathGame })))
const SpeakingGame = lazy(() => import('./SpeakingGame').then((m) => ({ default: m.SpeakingGame })))

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
  /** 3D 산책에서 옷을 갈아입을 때 */
  onOutfit: (next: Outfit) => void
  /** 수학·영어 같은 전체 화면 놀이가 열려 있으면 true (아래 여행 도감을 숨긴다) */
  onFull?: (full: boolean) => void
  /** 장소 안에서 "방 꾸미기"를 누르면 그 테마로 내 방을 연다 */
  onDecorate?: (placeId: string) => void
  /** 파티 친구 주문을 만들러 주방 탭으로 */
  onKitchen?: () => void
  /** 3D 산책 길가의 카페·농장 노점에서 그 탭으로 */
  onGo?: (to: 'cafe' | 'farm') => void
}

/** 여행 탭: 넓은 맵(OverWorld)을 걸어다니다가 문에 들어가면 그 장소 장면(TravelScene)으로 */
export function TravelGame({ outfit, tweaks, onWear, onOutfit, onFull, onDecorate, onKitchen, onGo, initialPlaceId = null }: Props) {
  const { lang } = useI18n()
  const [starRain, setStarRain] = useState(false)
  const [runner, setRunner] = useState(false)
  // 달리기: 가로(넓은) 화면은 전체 화면, 세로 화면은 아래에 여행 도감(아이템)을 같이 보여 준다 (앱의 가로 판정과 같은 기준)
  const [wide, setWide] = useState(() => window.matchMedia('(min-aspect-ratio: 6/5)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-aspect-ratio: 6/5)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const [speaking, setSpeaking] = useState(false)
  const [math, setMath] = useState(false)
  const [jump, setJump] = useState(false)
  const [flags, setFlags] = useState(false)
  const [soccer, setSoccer] = useState(false)
  const [walk3d, setWalk3d] = useState(takeWalkNext)
  /** 3D 산책에서 집에 들어갔으면, 집에서 나올 때 다시 3D 산책으로 */
  const [backToWalk, setBackToWalk] = useState(false)
  useEffect(() => { onFull?.(math || speaking || jump || soccer || flags || walk3d || (runner && wide)); return () => onFull?.(false) }, [math, speaking, jump, soccer, flags, walk3d, runner, wide, onFull])
  const game = useGame()
  const ver = useItemsVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assign = useMemo(currentAssignment, [ver])
  const [scene, setScene] = useState<string | null>(initialPlaceId)
  // 마을과 집 안에서는 배경 음악이 이어지고, 게임 화면(별비·수학·점프·영어)에서는 끈다
  const walking = !starRain && !runner && !math && !jump && !speaking && !soccer && !flags && !walk3d
  useEffect(() => { if (!walking) return; startBgm('room'); return stopBgm }, [walking])

  if (walk3d) return <Suspense fallback={null}><Walk3D outfit={outfit} tweaks={tweaks} onOutfit={onOutfit} onExit={() => setWalk3d(false)} onGo={onGo} onEnter={(id) => { travelTo(id); setScene(id); setBackToWalk(true); setWalk3d(false) }} /></Suspense>
  if (flags) return <Suspense fallback={null}><FlagGame onExit={() => setFlags(false)} /></Suspense>
  if (soccer) return <Suspense fallback={null}><SoccerGame onExit={() => setSoccer(false)} /></Suspense>
  if (runner) return <Suspense fallback={null}><RunnerGame outfit={outfit} tweaks={tweaks} onExit={() => setRunner(false)} /></Suspense>
  if (starRain) return <Suspense fallback={null}><StarRainWalk outfit={outfit} tweaks={tweaks} onExit={() => setStarRain(false)} /></Suspense>

  const actionButton = PILL
  const label = (text: string) => <PillText>{text}</PillText>
  return <div className="relative h-full">
    {scene ? <TravelScene paused={speaking} key={scene} placeId={scene} assign={assign} outfit={outfit} tweaks={tweaks} onExit={() => { setScene(null); if (backToWalk) { setBackToWalk(false); setWalk3d(true) } }} onWear={onWear} onDecorate={onDecorate} onKitchen={onKitchen} /> : <OverWorld
      paused={speaking} reach={game.reach} chunk={game.chunk} assign={assign} outfit={outfit} tweaks={tweaks}
      actions={<>
        <button className={actionButton} aria-label="한마디 영어" onClick={() => setSpeaking(true)}>{label(lang === 'ko' ? '영어' : 'Talk')}</button>
        <button className={actionButton} aria-label="별비 산책" onClick={() => setStarRain(true)}>{label(lang === 'ko' ? '별비' : 'Stars')}</button>
        <button className={actionButton} aria-label="달려라 아바타" onClick={() => setRunner(true)}>{label(lang === 'ko' ? '달리기' : 'Run')}</button>
        <button className={actionButton} aria-label="수학 놀이터" onClick={() => setMath(true)}>{label(lang === 'ko' ? '수학' : 'Math')}</button>
        <button className={actionButton} aria-label="점프 퍼즐" onClick={() => setJump(true)}>{label(lang === 'ko' ? '점프' : 'Jump')}</button>
        <button className={actionButton} aria-label="축구" onClick={() => setSoccer(true)}>{label(lang === 'ko' ? '축구' : 'Soccer')}</button>
        <button className={actionButton} aria-label={lang === 'ko' ? '국기 게임' : 'Flag quiz'} onClick={() => setFlags(true)}>{label(lang === 'ko' ? '국기' : 'Flags')}</button>
        <button className={actionButton} aria-label="3D 산책 (시험판)" onClick={() => setWalk3d(true)}>{label('3D')}</button>
      </>}
      onEnter={(id, chunk) => { travelTo(id, chunk); setScene(id) }}
    />}
    <Suspense fallback={null}>
    {speaking && <SpeakingGame onClose={() => setSpeaking(false)} />}
    {math && <MathGame onClose={() => setMath(false)} />}
    {jump && <JumpPuzzle onClose={() => setJump(false)} />}
    </Suspense>
  </div>
}

