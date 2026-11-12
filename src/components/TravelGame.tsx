import { Suspense, lazy, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { RACE_INVITE_EVENT, hasJumpInvite, hasRaceInvite, hasStarInvite } from '../lib/raceInvite'
import { takeWalkNext } from '../lib/farmCafeLink'
import { startBgm, stopBgm } from '../lib/sound'
import { currentAssignment, gameVersion, getGame, subscribeGame, travelTo } from '../lib/game'
import type { Outfit, Tweaks } from '../lib/types'
import { useItemsVersion } from '../lib/useItemsVersion'
import { useI18n } from '../i18n'
import { OverWorld } from './OverWorld'
import { multiplayerAvailable } from '../lib/mp/config'
import { MultiBadge, PILL, PILL_MULTI, PillText } from './pill'
import { TravelScene } from './TravelScene'

// 놀이 화면(축구·달리기·별비·점프·수학·영어)은 처음 열 때 받는다
const StarRainWalk = lazy(() => import('./StarRainWalk').then((m) => ({ default: m.StarRainWalk })))
const RaceGame = lazy(() => import('./RaceGame').then((m) => ({ default: m.RaceGame })))
const RunnerGame = lazy(() => import('./RunnerGame').then((m) => ({ default: m.RunnerGame })))
const StarChase = lazy(() => import('./StarChase').then((m) => ({ default: m.StarChase })))
const JumpPuzzle = lazy(() => import('./JumpPuzzle').then((m) => ({ default: m.JumpPuzzle })))
const FlagGame = lazy(() => import('./FlagGame').then((m) => ({ default: m.FlagGame })))
const SoccerGame = lazy(() => import('./SoccerGame').then((m) => ({ default: m.SoccerGame })))
// 3D 산책: three.js 가 커서 누를 때만 받는다
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
  /** 수학·영어 같은 전체 화면 놀이가 열려 있으면 true (아래 여행 도감을 숨긴다) */
  onFull?: (full: boolean) => void
  /** 장소 안에서 "방 꾸미기"를 누르면 그 테마로 내 방을 연다 */
  /** 산책 탭: 처음부터 3D 산책을 보여 주고, 산책을 닫으면 onLeaveWalk */
  walkTab?: boolean
  onLeaveWalk?: () => void
  /** 게임 탭의 「방꾸미기」 */
  onRoom?: () => void
  onDecorate?: (placeId: string) => void
  /** 파티 친구 주문을 만들러 주방 탭으로 */
  onKitchen?: () => void
  /** 3D 산책 길가의 카페·농장 노점에서 그 탭으로 */
  onGo?: (to: 'cafe' | 'farm') => void
}

/** 여행 탭: 넓은 맵(OverWorld)을 걸어다니다가 문에 들어가면 그 장소 장면(TravelScene)으로 */
export function TravelGame({ outfit, tweaks, onWear, onFull, onDecorate, onKitchen, onGo, initialPlaceId = null, walkTab = false, onLeaveWalk, onRoom }: Props) {
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
  const [jump, setJump] = useState(() => hasJumpInvite())
  const [flags, setFlags] = useState(false)
  const [soccer, setSoccer] = useState(false)
  const [starChase, setStarChase] = useState(() => hasStarInvite())
  const [race, setRace] = useState(() => hasRaceInvite())
  useEffect(() => { const f = () => { if (hasRaceInvite()) setRace(true); else if (hasJumpInvite()) setJump(true); else if (hasStarInvite()) setStarChase(true) }; window.addEventListener(RACE_INVITE_EVENT, f); return () => window.removeEventListener(RACE_INVITE_EVENT, f) }, [])
  // 산책 탭은 처음부터 3D 산책(✕ 를 누르면 게임 탭으로)
  const [walk3d, setWalk3d] = useState(() => takeWalkNext() || walkTab)
  /** 3D 산책에서 집에 들어갔으면, 집에서 나올 때 다시 3D 산책으로 */
  const [backToWalk, setBackToWalk] = useState(false)
  // 전체 화면(여행 도감 숨김): 놀이 화면들, 3D 산책, 3D 산책에서 들어간 집 안(가로 화면만)
  useEffect(() => { onFull?.(math || speaking || jump || starChase || soccer || race || flags || walk3d || (runner && wide) || (backToWalk && wide)); return () => onFull?.(false) }, [math, speaking, jump, starChase, soccer, race, flags, walk3d, runner, wide, backToWalk, onFull])

  const game = useGame()
  const ver = useItemsVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assign = useMemo(currentAssignment, [ver])
  const [scene, setScene] = useState<string | null>(initialPlaceId)
  // 마을과 집 안에서는 배경 음악이 이어지고, 게임 화면(별비·수학·점프·영어)에서는 끈다
  const walking = !starRain && !runner && !math && !jump && !starChase && !speaking && !soccer && !race && !flags && !walk3d
  // 산책 노래(room)는 2D 산책 마을, 3D 산책, 별 잡기에서 이어서 나온다
  const roomSong = walking || walk3d || starChase
  useEffect(() => { if (!roomSong) return; startBgm('room'); return stopBgm }, [roomSong])

  if (walk3d) return <Suspense fallback={null}><Walk3D outfit={outfit} tweaks={tweaks} onExit={() => { if (walkTab && onLeaveWalk) onLeaveWalk(); else setWalk3d(false) }} onGo={onGo} onEnter={(id) => { travelTo(id); setScene(id); setBackToWalk(true); setWalk3d(false) }} /></Suspense>
  if (flags) return <Suspense fallback={null}><FlagGame onExit={() => setFlags(false)} /></Suspense>
  if (race) return <Suspense fallback={null}><RaceGame onExit={() => setRace(false)} /></Suspense>
  if (soccer) return <Suspense fallback={null}><SoccerGame onExit={() => setSoccer(false)} /></Suspense>
  if (runner) return <Suspense fallback={null}><RunnerGame outfit={outfit} tweaks={tweaks} onExit={() => setRunner(false)} /></Suspense>
  if (starRain) return <Suspense fallback={null}><StarRainWalk outfit={outfit} tweaks={tweaks} onExit={() => setStarRain(false)} /></Suspense>

  const actionButton = PILL
  /** 친구와 같이 할 수 있는 게임(레이스·점프)은 분홍 테두리와 👫 배지로 구분한다 */
  const multiButton = multiplayerAvailable ? PILL_MULTI : PILL // 같이 놀기를 쓸 수 없는 앱(설정 없음)에서는 표시하지 않는다
  const label = (text: string) => <PillText>{text}</PillText>
  return <div className="relative h-full">
    {scene ? <TravelScene paused={speaking} key={scene} placeId={scene} assign={assign} outfit={outfit} tweaks={tweaks} onExit={() => { setScene(null); if (backToWalk) { setBackToWalk(false); setWalk3d(true) } }} onWear={onWear} onDecorate={onDecorate} onKitchen={onKitchen} /> : <OverWorld
      paused={speaking} reach={game.reach} chunk={game.chunk} assign={assign} outfit={outfit} tweaks={tweaks}
      actions={<>
        <button className={actionButton} aria-label="한마디 영어" onClick={() => setSpeaking(true)}>{label(lang === 'ko' ? '영어' : 'Talk')}</button>
        <button className={actionButton} aria-label="별비 산책" onClick={() => setStarRain(true)}>{label(lang === 'ko' ? '별비' : 'Stars')}</button>
        <button className={actionButton} aria-label="달려라 아바타" onClick={() => setRunner(true)}>{label(lang === 'ko' ? '달리기' : 'Run')}</button>
        <button className={actionButton} aria-label="수학 놀이터" onClick={() => setMath(true)}>{label(lang === 'ko' ? '수학' : 'Math')}</button>
        <button className={multiButton} aria-label="점프 퍼즐(친구와 같이 할 수 있어요)" onClick={() => setJump(true)}>{label(lang === 'ko' ? '점프' : 'Jump')}{multiplayerAvailable && <MultiBadge />}</button>
        <button className={actionButton} aria-label="축구" onClick={() => setSoccer(true)}>{label(lang === 'ko' ? '축구' : 'Soccer')}</button>
        <button className={multiButton} aria-label="자동차 레이스(친구와 같이 할 수 있어요)" onClick={() => setRace(true)}>{label(lang === 'ko' ? '레이스' : 'Race')}{multiplayerAvailable && <MultiBadge />}</button>
        <button className={actionButton} aria-label={lang === 'ko' ? '국기 게임' : 'Flag quiz'} onClick={() => setFlags(true)}>{label(lang === 'ko' ? '국기' : 'Flags')}</button>
        <button className={multiButton} aria-label="도망간 별을 잡아라(친구와 같이 할 수 있어요)" onClick={() => setStarChase(true)}>{label(lang === 'ko' ? '별잡기' : 'Catch')}{multiplayerAvailable && <MultiBadge />}</button>
        {onRoom && <button className={actionButton} aria-label="방꾸미기" onClick={onRoom}>{label(lang === 'ko' ? '방꾸미기' : 'Room')}</button>}
      </>}
      onEnter={(id, chunk) => { travelTo(id, chunk); setScene(id) }}
    />}
    <Suspense fallback={null}>
    {speaking && <SpeakingGame onClose={() => setSpeaking(false)} />}
    {math && <MathGame onClose={() => setMath(false)} />}
    {jump && <JumpPuzzle onClose={() => setJump(false)} />}
    {starChase && <StarChase outfit={outfit} onClose={() => setStarChase(false)} />}
    </Suspense>
  </div>
}

