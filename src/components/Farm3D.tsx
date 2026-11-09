import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { SPARKLE_IMG } from './Sparkle'
import { attachMultiplayer } from './remotePlayers3d'
import { attachBoss, freeSpot, type BossDone, type BossHunt, type BossUi } from './bossHunt3d'
import { BossHud } from './BossHud'
import { animal3dAspect, animal3dUrl, walkingAway } from '../lib/animals3d'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { getAvatar } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import { ANIMAL_SECONDS, CROPS, FENCE_PRICE, MAIN_PLOTS, PLOT_COUNT, actFarm, animalWait, getFarm, growth, orderCrop, plotPrice, subscribeFarm, type AnimalGood, type CropId, type FarmAction } from '../lib/farm'
import { MAX_FARM_FRIENDS, getFarmFriends, getFriendJobs, harvestAll, setFarmFriends, subscribeFarmFriends, waterNow } from '../lib/farmFriends'
import { actKitchen } from '../lib/kitchen'
import { getMeet, notCollected, subscribeMeet } from '../lib/meet'
import { setGuestLooks } from '../lib/guestLooks'
import { assetUrl } from '../lib/items'
import { guestAvatar, guestFace } from '../lib/party'
import { guestLook } from '../lib/guestLooks'
import { playCoin, playHarvest, playPlant, playTap, playWater } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { CoinIcon } from './Icons'
import { FarmStall } from './FarmStall'
import { PartyInvite } from './PartyGuests'
import { cafeShopSprite, viewSprite } from './viewSprite3d'
import { ANIMAL_H, AVATAR_H, FEET, createWorld, showBack, meadowTree, emojiCanvas, signCanvas, type Doll, type World } from './world3d'

/**
 * 3D 농장: 큰 밭 20칸과 옆 울타리 밭 8칸(농장 탭과 같은 밭·같은 저장)을 3D 들판에 깔고, 아바타가 걸어가서 심고·물 주고·수확한다.
 * 밭을 누르면 그 밭이 필요로 하는 일(심기 → 물주기 → 다 자라면 수확)을 한다. 작물은 농장 그림을 세운 종이 인형.
 * 같이 농사짓는 동물 친구는 밭 둘레를 거닌다(물 주기는 농장 탭처럼 친구들이 따로 한다).
 */
const COLS = 5, ROWS = 4
/** 밭 한 칸 크기(예전의 2/3)와 칸 사이 */
const PW = 2.6 * (2 / 3), PD = 2.0 * (2 / 3), GAP = 0.5
const BOUNDS = 40
/** 옆 울타리 밭(20~39번): 큰 밭 오른쪽 옆 땅에 큰 밭과 같은 5칸×4줄 */
const SIDE_COLS = 5
const SIDE_X = (COLS * (PW + GAP)) / 2 + 1.2 + 4 + (SIDE_COLS * (PW + GAP)) / 2 + 1.2
/** 작물 그림 크기(가로·세로 px) */
const CROP_BOX: Record<CropId, [number, number]> = { carrot: [568, 499], strawberry: [578, 453], corn: [505, 619] }
const stageOf = (wateredAt: number | null, progress: number) => (wateredAt === null ? 1 : progress >= 1 ? 4 : progress < 0.4 ? 2 : 3)
/** 밭 자리: 처음부터 내 밭인 앞 칸(0~8)이 들어오는 문(앞쪽, +z) 가까이 오게 줄 번호가 클수록 뒤로 */
const plotAt = (i: number) => {
  // 옆 밭: 확장 모드에서 놓은 자리가 있으면 그 자리
  const placed = i >= MAIN_PLOTS ? getFarm().sidePos[i] : undefined
  if (placed) return { x: placed[0], z: placed[1] }
  if (i >= MAIN_PLOTS) { const j = i - MAIN_PLOTS; return { x: SIDE_X + ((j % SIDE_COLS) - (SIDE_COLS - 1) / 2) * (PW + GAP), z: -(Math.floor(j / SIDE_COLS) - (ROWS - 1) / 2) * (PD + GAP) - 4 } }
  return { x: ((i % COLS) - (COLS - 1) / 2) * (PW + GAP), z: -(Math.floor(i / COLS) - (ROWS - 1) / 2) * (PD + GAP) - 4 }
}

/** 카페 가는 길: 농장 문(앞쪽, +z)에서 굽이굽이 뻗고, 길 끝 카페 가게 앞(CAFE_GATE)까지 가면 카페로 넘어간다 */
const CAFE_GATE = 34
/** 카페 가는 길이 지나는 x(z 에 따라 좌우로 굽이친다, 양 끝은 가운데) */
const cafeRoadX = (z: number) => { const u = Math.max(0, Math.min(1, (z - 7) / (CAFE_GATE - 7))); return Math.sin(u * Math.PI * 2) * 3.2 * Math.sin(u * Math.PI) }
/** 🦅 위에서 볼 때 높이(작을수록 크게 보인다) */
const VIEW_MIN = 12
const VIEW_MAX = 60

export function Farm3D({ outfit, tweaks, onExit, arrive = false, onCafe, onKitchen, onWalk }: {
  /** 분홍 성(산책길)으로 들어가면 */
  onWalk?: () => void
  outfit: Outfit; tweaks: Tweaks; onExit: () => void
  /** 주방 버튼 */
  onKitchen?: () => void
  /** 카페에서 걸어왔으면 카페 가는 길 끝에서 시작 */
  arrive?: boolean
  /** 카페 가는 길 끝에 닿으면 */
  onCafe?: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const world = useRef<World | null>(null)
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [ready, setReady] = useState(false)
  /** 길을 넘어갈 때 하얗게 덮었다 걷는 막 */
  const [fade, setFade] = useState(arrive)
  useEffect(() => { if (!fade || !arrive) return; const t = setTimeout(() => setFade(false), 350); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const onCafeRef = useRef(onCafe)
  const onWalkRef = useRef(onWalk)
  onWalkRef.current = onWalk
  const gateRef = useRef<{ x: number; z: number; root: THREE.Object3D } | null>(null)
  onCafeRef.current = onCafe
  // 같이 사냥 대왕 몬스터
  const bossRef = useRef<BossHunt | null>(null)
  const [bossUi, setBossUi] = useState<BossUi | null>(null)
  const [bossDone, setBossDone] = useState<BossDone | null>(null)
  const [seed, setSeed] = useState<CropId>('strawberry')
  const seedRef = useRef(seed)
  seedRef.current = seed
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 2200); return () => clearTimeout(t) }, [notice])
  // 2D 농장과 같은 것들: 밭 사기, 우유·달걀, 같이 농사짓는 친구, 물주기·수확 버튼, 주방
  const [buying, setBuying] = useState<number | null>(null)
  // 확장 모드(3D): 옆 밭을 원하는 곳에 설치하거나 옮긴다
  const [placing, setPlacing] = useState(false)
  const placingRef = useRef(false)
  placingRef.current = placing
  const [moving, setMoving] = useState<number | null>(null)
  const movingRef = useRef<number | null>(null)
  /** 확장 모드 도구: 밭 설치·옮기기 또는 울타리(방향 0 가로·1 세로) */
  const [tool, setTool] = useState<'plot' | 'fence'>('plot')
  const toolRef = useRef(tool)
  toolRef.current = tool
  const [fenceDir, setFenceDir] = useState<0 | 1>(0)
  /** 옮기려고 고른 울타리(그 자리) */
  const [pickedFence, setPickedFence] = useState<[number, number] | null>(null)
  const pickedFenceRef = useRef(pickedFence)
  pickedFenceRef.current = pickedFence
  const fenceDirRef = useRef(fenceDir)
  fenceDirRef.current = fenceDir
  movingRef.current = moving
  const fenceAtRef = useRef<(x: number, z: number, r?: 0 | 1) => void>(() => {})
  /** 꾹 눌러 끌고 있는 울타리(있으면 지도 옮기기를 멈춘다) */
  const fenceDragRef = useRef(false)
  /** 살지 물어보는 울타리 자리 */
  const [buyFence, setBuyFence] = useState<{ x: number; z: number; r: 0 | 1 } | null>(null)
  const confirmFence = () => {
    const f = buyFence
    setBuyFence(null)
    if (!f) return
    if (actFarm({ type: 'fence', x: f.x, z: f.z, r: f.r }) === 'saved') { playCoin(); setNotice(`울타리 한 칸 설치 · -${FENCE_PRICE}코인`) } else setNotice(getFarm().coins < FENCE_PRICE ? '코인이 모자라요' : '여기에는 이미 울타리가 있어요')
  }
  const endPlacing = () => { setPlacing(false); setMoving(null); setPickedFence(null); setBuyFence(null) }
  // 🦅 위(배치 모드)에서는 하늘 위에서 농장을 지도처럼 내려다본다: 두 손가락·휠·＋/－ 로 확대, 끌어서 옮긴다
  const viewRef = useRef({ x: 9, z: -3, h: 40 })
  const zoomBy = (k: number) => { const v = viewRef.current; v.h = Math.max(VIEW_MIN, Math.min(VIEW_MAX, v.h * k)); if (placingRef.current) world.current?.setOverhead({ ...v }) }
  useEffect(() => { world.current?.setOverhead(placing ? { ...viewRef.current } : null) }, [placing])
  useEffect(() => {
    const el = host.current
    if (!el) return
    const pts = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const down = (e: PointerEvent) => { if (placingRef.current) pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y) } }
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId)
      if (!placingRef.current || !prev) return
      // 울타리를 꾹 눌러 끄는 동안에는 지도를 옮기지 않는다
      if (fenceDragRef.current) { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); return }
      const v = viewRef.current
      if (pts.size >= 2) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0 && d > 0) zoomBy(pinch / d)
        pinch = d
        return
      }
      // 한 손가락: 지도를 끈 만큼 옮긴다(화면 1픽셀 = 땅 몇 칸)
      const cam = world.current?.camera, upp = cam ? (2 * v.h * Math.tan((cam.fov * Math.PI) / 360)) / el.clientHeight : 0.05
      v.x = Math.max(-40, Math.min(50, v.x - (e.clientX - prev.x) * upp)); v.z = Math.max(-45, Math.min(40, v.z - (e.clientY - prev.y) * upp))
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      world.current?.setOverhead({ ...v })
    }
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0 }
    const wheel = (e: WheelEvent) => { if (!placingRef.current) return; e.preventDefault(); zoomBy(1 + Math.max(-0.3, Math.min(0.3, e.deltaY * 0.0015))) }
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 씨앗 고르기 칸(씨앗 단추로 연다)
  const [seedOpen, setSeedOpen] = useState(false)
  /** ＋ 자리를 눌렀을 때: 고른 밭을 거기로 옮기거나, 새 밭을 설치해서 거기에 놓는다 */
  const placeAt = (x: number, z: number) => {
    if (moving !== null) {
      if (apply({ type: 'place', plot: moving, x, z })) setNotice('밭을 옮겼어요 🌱')
      setMoving(null)
      return
    }
    const st = getFarm()
    const i = st.owned.findIndex((o, k) => k >= MAIN_PLOTS && !o)
    if (i < 0) { setNotice('옆 밭 20칸을 모두 설치했어요'); return }
    if (st.coins < plotPrice(st)) { setNotice('코인이 모자라요'); return }
    if (apply({ type: 'buy', plot: i })) { actFarm({ type: 'place', plot: i, x, z }); setNotice('새 밭을 설치했어요! 🌱') }
  }
  const placeAtRef = useRef(placeAt)
  placeAtRef.current = placeAt
  const [stall, setStall] = useState(false)
  const [picking, setPicking] = useState(false)
  const friendsNow = useSyncExternalStore(subscribeFarmFriends, getFarmFriends)
  const meet = useSyncExternalStore(subscribeMeet, getMeet)
  /** 밭 일·사기·팔기 하나(소리와 실패 안내 포함) */
  const apply = (a: FarmAction) => {
    const r = actFarm(a)
    if (r === 'saved') {
      if (a.type === 'plant') playPlant()
      else if (a.type === 'water') playWater()
      else if (a.type === 'harvest') playHarvest()
      else playCoin()
    } else if (r === 'failed') setNotice('저장하지 못했어요. 저장 공간을 확인해주세요.')
    else setNotice('아직 할 수 없는 동작이에요.')
    return r === 'saved'
  }
  const applyRef = useRef(apply)
  applyRef.current = apply
  /** 젖소·닭에게서 우유·달걀 받기: 주방 냉장고에 하나 들어간다 */
  const collect = (g: AnimalGood) => {
    const wait = animalWait(getFarm(), g, Date.now())
    if (wait > 0) { setNotice(`${wait}초 뒤에 다시 받을 수 있어요`); return }
    if (actFarm({ type: 'collect', good: g }) !== 'saved') return
    actKitchen({ type: 'add', id: g, n: 1 })
    playHarvest()
    setNotice(g === 'milk' ? '🥛 우유를 받았어요! 주방 냉장고에 넣었어요' : '🥚 달걀을 받았어요! 주방 냉장고에 넣었어요')
  }
  const collectRef = useRef(collect)
  collectRef.current = collect
  /** 물주기·수확 버튼: 아바타가 밭을 차례로 돈다(월드가 만들어지면 채운다) */
  const choreRef = useRef<(kind: 'water' | 'harvest', plots: number[]) => void>(() => {})
  const doChore = (kind: 'water' | 'harvest') => {
    playTap()
    const st = getFarm(), now = Date.now()
    const need = (i: number) => st.owned[i] && !!st.plots[i] && (kind === 'water' ? st.plots[i]!.wateredAt === null : growth(st.plots[i], now) === 1)
    const all = Array.from({ length: PLOT_COUNT }, (_, i) => i).filter(need)
    if (!all.length) { setNotice(kind === 'water' ? '물 줄 밭이 없어요' : '아직 다 자란 작물이 없어요'); return }
    // 친구가 있으면 큰 밭·옆 밭 모두 친구들이
    let mine = all
    if (friendsNow.length) {
      if (kind === 'water') waterNow(); else harvestAll(now)
      mine = []
      setNotice(kind === 'water' ? '친구들이 물을 주러 가요 💧' : '친구들이 수확하러 가요 🧺')
    } else setNotice(kind === 'water' ? '물 주러 가요 💧' : '수확하러 가요 🧺')
    if (mine.length) choreRef.current(kind, mine)
  }

  useEffect(() => {
    const el = host.current
    if (!el) return
    const plotOf = new Map<THREE.Object3D, number>()
    const busy = new Set<number>()
    // onPick 이 아래에서 만드는 것들(노점·우리 동물)을 쓴다
    let stallGroup: THREE.Group | null = null
    let penned: { doll: Doll; good: AnimalGood | null }[] = []
    let PEN = { x0: 0, x1: 0, z0: 0, z1: 0 }
    let showLed: (i: number) => void = () => {}
    // 확장 모드의 ＋ 자리들(아래에서 만든다)
    const fenceOf = new Map<THREE.Object3D, [number, number]>()
    const cleanups: (() => void)[] = []
    const slotOf = new Map<THREE.Object3D, number>()
    let slots: { x: number; z: number; box: THREE.Mesh; hit: THREE.Mesh; mark: THREE.Sprite }[] = []
    const w = createWorld(el, {
      bounds: BOUNDS, tiltable: true, start: arrive ? { x: cafeRoadX(CAFE_GATE - 7), z: CAFE_GATE - 7 } : { x: 0, z: 6 }, seed: 11, grass: assetUrl('cafe/3d/grass.webp'), onReady: () => setReady(true),
      // 밭을 누르면 밭 앞까지 걸어가서 그 밭이 필요로 하는 일을 한다
      // 확장 모드: 땅을 누르면 그 자리에 새 밭(또는 옮길 밭) 미리보기
      onGround: (x, z) => {
        if (!placingRef.current) return false
        if (fenceDragRef.current) return true
        if (toolRef.current === 'fence') { fenceAtRef.current(x, z); return true }
        setNotice('＋ 자리를 눌러요')
        return true
      },
      onPick: (o) => {
        if (!placingRef.current && bossRef.current?.pick(o)) return
        // 확장 모드에서는 노점·동물을 누르지 않는다
        if (placingRef.current && toolRef.current === 'fence') {
          if (fenceDragRef.current) return
          const fp = fenceOf.get(o)
          // 울타리 모드: 놓은 울타리를 누르면 옮길 울타리로 고른다(한 번 더 누르면 취소)
          if (fp) { playTap(); const cur = pickedFenceRef.current; setPickedFence(cur && cur[0] === fp[0] && cur[1] === fp[1] ? null : fp) }
          return
        }
        if (placingRef.current) {
          const k = slotOf.get(o)
          if (k !== undefined) { placeAtRef.current(slots[k].x, slots[k].z); return }
          if (!plotOf.has(o)) return
        }
        // 분홍 성: 문 앞까지 걸어가면 산책길로
        if (gateRef.current && o === gateRef.current.root) { const g = gateRef.current; w.walkTo(g.x, g.z, undefined, 0.3); return }
        // 노점·우리 동물
        if (o === stallGroup) { w.walkTo(stallGroup.position.x + 1.8, stallGroup.position.z, () => setStall(true), 0.4); return }
        const an = penned.find((a) => a.doll.root === o)
        if (an) {
          if (!an.good) { setNotice('메에~ 🐑 털이 보송보송해요'); return }
          const g = an.good
          w.walkTo((PEN.x0 + PEN.x1) / 2, (PEN.z0 + PEN.z1) / 2, () => collectRef.current(g), 5.3)
          return
        }
        const i = plotOf.get(o)
        // 확장 모드: 설치한 옆 밭을 누르면 옮길 밭으로 고른다(다른 것은 누르지 않는다)
        if (placingRef.current) {
          if (i !== undefined && i >= MAIN_PLOTS) {
            if (movingRef.current === i) { setMoving(null); return } // 한 번 더 누르면 그만 옮기기
            setMoving(i); showLed(i); setNotice('옮길 ＋ 자리를 눌러요')
          }
          return
        }
        if (i === undefined) return
        showLed(i)
        if (busy.has(i)) return
        const st = getFarm()
        // 아직 못 산 밭: 밭 앞까지 가서 살지 묻는다
        if (!st.owned[i]) { const p = plotAt(i); w.walkTo(p.x, p.z + PD / 2 + 0.6, () => setBuying(i), 0.3); return }
        const plot = st.plots[i]
        const need = !plot ? 'seed' : plot.wateredAt === null ? 'water' : growth(plot, Date.now()) === 1 ? 'harvest' : null
        if (!need) { setNotice('자라는 중이에요 🌱'); return }
        busy.add(i)
        const p = plotAt(i)
        w.walkTo(p.x, p.z + PD / 2 + 0.6, () => {
          window.setTimeout(() => {
            busy.delete(i)
            if (need === 'seed') applyRef.current({ type: 'plant', plot: i, crop: seedRef.current })
            else if (need === 'water') applyRef.current({ type: 'water', plot: i })
            else applyRef.current({ type: 'harvest', plot: i })
          }, 250)
        }, 0.3)
      },
    })
    world.current = w
    // 같이 놀기(멀티플레이어): 켜지 않으면 아무것도 하지 않는다
    const detachMp = attachMultiplayer(w, 'farm')
    // 같이 사냥하는 대왕 몬스터(같이 놀기 중일 때만, 밭·우리·노점을 피해 빈 땅에)
    bossRef.current = attachBoss(w, 'farm', { spot: () => freeSpot(w, BOUNDS - 8, Array.from({ length: PLOT_COUNT }, (_, i) => ({ ...plotAt(i), r: 3.5 }))), holdWeapon: true, canFight: () => !placingRef.current, onUi: setBossUi, onDone: setBossDone })
    const { scene, rnd, keep, lambert } = w

    // 큰 밭 20칸 + 옆 밭 20칸: 흙 상자(마른 흙·젖은 흙·못 산 큰 밭은 풀빛, 설치 안 한 옆 밭은 흐린 흙) + 작물 둘 + 표시(💧 물 필요, ✨ 다 자람, 🔒 잠김)
    const boxGeo = keep(new THREE.BoxGeometry(PW, 0.22, PD))
    const ridgeGeo = keep(new THREE.BoxGeometry(PW * 0.92, 0.08, 0.16))
    const dryMat = lambert(0xc4935f), wetMat = lambert(0x7d5234), lockedMat = lambert(0xa9cf86), ridgeDry = lambert(0xb07e4c), ridgeWet = lambert(0x6a4329)
    const icon = (s: string) => keep(new THREE.SpriteMaterial({ map: w.texOf(emojiCanvas(s)), transparent: true, depthWrite: false }))
    const iconMats = { water: icon('💧'), ready: keep(new THREE.SpriteMaterial({ map: w.texOf(assetUrl(SPARKLE_IMG)), transparent: true, depthWrite: false })), lock: icon('🔒'), add: icon('➕') }
    // 누른 밭 둘레에 초록 LED 테두리(어느 밭을 눌렀는지 잘 보이게)
    const ledMat = keep(new THREE.MeshBasicMaterial({ color: 0x19e64f, transparent: true, opacity: 0.95, depthWrite: false }))
    const lw = PW + 0.4, ld = PD + 0.4, t = 0.08 // 테두리만, 얇게
    const barGeos = [[lw, t], [lw, t], [t, ld], [t, ld]].map(([sx, sz]) => keep(new THREE.BoxGeometry(sx, 0.05, sz)))
    const makeLed = () => {
      const g = new THREE.Group()
      ;[[0, -ld / 2], [0, ld / 2], [-lw / 2, 0], [lw / 2, 0]].forEach(([x, z], k) => { const bar = new THREE.Mesh(barGeos[k], ledMat); bar.position.set(x, 0, z); g.add(bar) })
      g.visible = false
      scene.add(g)
      return g
    }
    const ledAt = (g: THREE.Group, i: number) => { const p = plotAt(i); g.position.set(p.x, 0.26, p.z); g.visible = true }
    // 누른 밭(심기·물주기·수확 모두): 누른 뒤 2.6초 + 그 밭 일을 마칠 때까지 켜 둔다
    const led = makeLed()
    let ledUntil = 0, ledPlot = -1
    showLed = (i: number) => { ledAt(led, i); ledPlot = i; ledUntil = performance.now() + 2600 }
    // 일하는 밭: 물주기·수확 버튼으로 아바타가 도는 밭, 친구가 일하는 밭에도 켠다
    const choreLed = makeLed()
    const friendLeds = [makeLed(), makeLed()]
    // 누르기 쉽게: 밭보다 조금 크고 높은 보이지 않는 상자를 누르는 자리로
    const hitGeo = keep(new THREE.BoxGeometry(PW + GAP * 0.9, 1.4, PD + GAP * 0.9)), hitMat = keep(new THREE.MeshBasicMaterial({ visible: false }))
    const cropTex = new Map<string, THREE.Texture>()
    const texFor = (crop: CropId, stage: number) => {
      const k = `${crop}_${stage}`
      if (!cropTex.has(k)) cropTex.set(k, w.texOf(assetUrl(`assets/farm/${k}.webp`)))
      return cropTex.get(k)!
    }
    const plots = Array.from({ length: PLOT_COUNT }, (_, i) => {
      const p = plotAt(i)
      const box = new THREE.Mesh(boxGeo, dryMat)
      box.position.set(p.x, 0.11, p.z)
      box.receiveShadow = true
      const ridges = [-PD / 4, 0, PD / 4].map((dz) => { const r = new THREE.Mesh(ridgeGeo, ridgeDry); r.position.set(p.x, 0.25, p.z + dz); scene.add(r); return r })
      scene.add(box)
      const hit = new THREE.Mesh(hitGeo, hitMat)
      hit.position.set(p.x, 0.7, p.z)
      scene.add(hit)
      plotOf.set(hit, i)
      const crops = [-PW * 0.23, PW * 0.23].map((dx) => {
        const d = w.paperDoll(texFor('strawberry', 1), 1, 1)
        d.root.position.set(p.x + dx, 0.22, p.z)
        d.root.visible = false
        return d
      })
      const mark = new THREE.Sprite(iconMats.water)
      mark.position.set(p.x, 1.6, p.z)
      mark.scale.setScalar(0.6)
      mark.visible = false
      scene.add(mark)
      return { box, ridges, crops, mark, hit, key: '', at: '' }
    })
    // 지금 밭 상태대로 다시 칠한다(바뀐 칸만)
    const paint = () => {
      const st = getFarm(), now = Date.now()
      plots.forEach((v, i) => {
        // 자리·보이기: 옆 밭은 설치한 것만 보이고(확장 모드에서 놓은 자리에), 누르는 자리도 그때만
        const p = plotAt(i), shown = i < MAIN_PLOTS || st.owned[i], at = `${p.x},${p.z},${shown}`
        if (at !== v.at) {
          v.at = at
          v.box.position.set(p.x, 0.11, p.z); v.hit.position.set(p.x, 0.7, p.z); v.mark.position.set(p.x, 1.6, p.z)
          v.ridges.forEach((r, k) => r.position.set(p.x, 0.25, p.z + (k - 1) * (PD / 4)))
          v.crops.forEach((c, k) => c.root.position.set(p.x + (k ? PW * 0.23 : -PW * 0.23), 0.22, p.z))
          v.box.visible = shown
          const k = w.pickables.indexOf(v.hit)
          if (shown && k < 0) w.pickables.push(v.hit)
          if (!shown && k >= 0) w.pickables.splice(k, 1)
          v.key = ''
        }
        if (!shown) { for (const r of v.ridges) r.visible = false; for (const c of v.crops) c.root.visible = false; v.mark.visible = false; return }
        const plot = st.plots[i], prog = growth(plot, now)
        const stage = plot ? stageOf(plot.wateredAt, prog) : 0
        const key = `${st.owned[i]}|${plot?.crop}|${stage}|${plot?.wateredAt === null}`
        if (key === v.key) return
        v.key = key
        const wet = !!plot && plot.wateredAt !== null && prog < 1
        v.box.material = !st.owned[i] ? lockedMat : wet ? wetMat : dryMat
        for (const r of v.ridges) { r.visible = st.owned[i]; r.material = wet ? ridgeWet : ridgeDry }
        for (const c of v.crops) {
          c.root.visible = !!plot
          if (plot) {
            const [bw, bh] = CROP_BOX[plot.crop], h = (plot.crop === 'corn' ? 1.3 : 1.0) * (stage === 1 ? 0.75 : stage === 2 ? 0.85 : 1)
            const m = c.doll.material as THREE.MeshBasicMaterial
            m.map = texFor(plot.crop, stage)
            m.needsUpdate = true
            c.body.scale.set((h * bw) / bh, h, 1) // 판 크기는 body 에(face 가 doll 의 좌우를 바꾼다)
          }
        }
        v.mark.visible = !st.owned[i] || (!!plot && (plot.wateredAt === null || prog >= 1))
        v.mark.material = !st.owned[i] ? iconMats.lock : plot && prog >= 1 ? iconMats.ready : iconMats.water
        v.mark.scale.setScalar(st.owned[i] ? 0.6 : 0.35)
      })
    }
    paint()
    const unsub = subscribeFarm(paint)

    // 울타리: 밭 둘레에 나무 기둥과 가로대
    const fx = (COLS * (PW + GAP)) / 2 + 1.2, fz0 = -4 - (ROWS * (PD + GAP)) / 2 - 1.2, fz1 = -4 + (ROWS * (PD + GAP)) / 2 + 1.2
    const postGeo = keep(new THREE.BoxGeometry(0.18, 1, 0.18)), postMat = lambert(0xfff6e8)
    const railGeo = keep(new THREE.BoxGeometry(1, 0.12, 0.08))
    const fenceLine = (x0: number, z0: number, x1: number, z1: number, gapAt?: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 1.6)
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t
        if (gapAt !== undefined && Math.abs(x - gapAt) < 2.2) continue // 들어가는 문
        const post = new THREE.Mesh(postGeo, postMat)
        post.position.set(x, 0.5, z)
        post.castShadow = true
        scene.add(post)
        if (k < n && !(gapAt !== undefined && Math.abs(x + (x1 - x0) / n - gapAt) < 2.2)) for (const y of [0.35, 0.75]) {
          const rail = new THREE.Mesh(railGeo, postMat)
          rail.scale.x = len / n
          rail.position.set(x + (x1 - x0) / n / 2, y, z + (z1 - z0) / n / 2)
          rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0)
          scene.add(rail)
        }
      }
    }
    // 산 울타리: 한 칸(길이 1.6)마다 기둥 둘 + 가로대 둘. 저장(farm.fences)이 바뀌면 다시 세운다. 아바타는 지나가지 못한다
    const FL = 1.6
    const fenceGroup = new THREE.Group()
    scene.add(fenceGroup)
    const fenceHitGeo = keep(new THREE.BoxGeometry(FL, 1.2, 0.5)), fenceHitMat = keep(new THREE.MeshBasicMaterial({ visible: false }))
    let fenceKey = '', fenceObs: { x: number; z: number; r: number }[] = []
    const buildFences = () => {
      const list = getFarm().fences, key = JSON.stringify(list)
      if (key === fenceKey) return
      fenceKey = key
      for (const o of [...fenceGroup.children]) { fenceGroup.remove(o); const k = w.pickables.indexOf(o); if (k >= 0) w.pickables.splice(k, 1) }
      fenceOf.clear()
      for (const ob of fenceObs) { const k = w.obstacles.indexOf(ob); if (k >= 0) w.obstacles.splice(k, 1) }
      fenceObs = []
      for (const [x, z, r] of list) {
        const seg = new THREE.Group()
        seg.position.set(x, 0, z)
        seg.rotation.y = r ? Math.PI / 2 : 0
        for (const dx of [-FL / 2, FL / 2]) { const post = new THREE.Mesh(postGeo, postMat); post.position.set(dx, 0.5, 0); post.castShadow = true; seg.add(post) }
        for (const y of [0.35, 0.75]) { const rail = new THREE.Mesh(railGeo, postMat); rail.scale.x = FL; rail.position.y = y; seg.add(rail) }
        const hit = new THREE.Mesh(fenceHitGeo, fenceHitMat); hit.position.y = 0.6; seg.add(hit)
        fenceGroup.add(seg)
        fenceOf.set(hit, [x, z]); w.pickables.push(hit)
        for (const t of [-0.5, 0, 0.5]) { const ob = { x: x + (r ? 0 : t * FL), z: z + (r ? t * FL : 0), r: 0.35 }; fenceObs.push(ob); w.obstacles.push(ob) }
      }
    }
    buildFences()
    const fenceLed = new THREE.Mesh(keep(new THREE.BoxGeometry(FL + 0.4, 0.05, 0.7)), keep(new THREE.MeshBasicMaterial({ color: 0x19e64f, transparent: true, opacity: 0.6, depthWrite: false })))
    fenceLed.visible = false
    scene.add(fenceLed)
    const unsubFence = subscribeFarm(buildFences)
    // 울타리 꾹 눌러 옮기기(🦅 위 · 울타리 도구): 0.35초 누르고 있으면 들려서 손가락을 따라오고, 떼면 그 칸에 놓인다(방향은 그대로)
    {
      const rc = new THREE.Raycaster(), nd = new THREE.Vector2()
      const rayAt = (cx: number, cy: number) => { const r = el.getBoundingClientRect(); nd.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); rc.setFromCamera(nd, w.camera); return rc }
      let hold: { id: number; x: number; y: number; timer: number; fp: [number, number]; r: 0 | 1; seg: THREE.Object3D; at?: { x: number; z: number } } | null = null
      const cancel = () => { if (hold) clearTimeout(hold.timer); hold = null }
      const down = (e: PointerEvent) => {
        cancel()
        if (!placingRef.current || toolRef.current !== 'fence') return
        const hit = rayAt(e.clientX, e.clientY).intersectObjects([...fenceOf.keys()], false)[0]
        const fp = hit && fenceOf.get(hit.object)
        if (!hit || !fp) return
        const f = getFarm().fences.find(([x, z]) => x === fp[0] && z === fp[1])
        hold = { id: e.pointerId, x: e.clientX, y: e.clientY, fp, r: f?.[2] ? 1 : 0, seg: hit.object.parent!, timer: 0 }
        hold.timer = window.setTimeout(() => {
          if (!hold) return
          fenceDragRef.current = true
          playTap(); setPickedFence(hold.fp)
          hold.seg.position.y = 0.4 // 살짝 들어 올린다
        }, 350)
      }
      const move = (e: PointerEvent) => {
        if (!hold || e.pointerId !== hold.id) return
        if (!fenceDragRef.current) { if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) cancel(); return } // 꾹 누르기 전에 움직이면 지도 옮기기
        const g = rayAt(e.clientX, e.clientY).intersectObject(w.ground)[0]
        if (!g) return
        hold.at = { x: g.point.x, z: g.point.z }
        hold.seg.position.set(g.point.x, 0.4, g.point.z)
      }
      const up = (e: PointerEvent) => {
        if (!hold || e.pointerId !== hold.id) return
        const h = hold
        cancel()
        if (!fenceDragRef.current) return
        // 다음 땅 누르기(탭)로 다시 옮겨지지 않게, 놓은 뒤에 끝낸다
        window.setTimeout(() => { fenceDragRef.current = false }, 0)
        const before = getFarm().fences
        if (h.at) { pickedFenceRef.current = h.fp; fenceAtRef.current(h.at.x, h.at.z, h.r) }
        // 옮기지 못했으면(밭 안·길 위·겹침) 제자리로
        if (getFarm().fences === before) h.seg.position.set(h.fp[0], 0, h.fp[1])
        setPickedFence(null)
      }
      el.addEventListener('pointerdown', down)
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      cleanups.push(() => { cancel(); el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) })
    }
    fenceAtRef.current = (x, z, dir) => {
      const r = dir ?? fenceDirRef.current
      // 칸에 맞춰 놓는다: 가로 울타리는 x 를 칸 가운데, z 는 칸 경계에
      const gx = r ? Math.round(x / FL) * FL : Math.floor(x / FL) * FL + FL / 2, gz = r ? Math.floor(z / FL) * FL + FL / 2 : Math.round(z / FL) * FL
      const X = Math.round(gx * 100) / 100, Z = Math.round(gz * 100) / 100
      if (X > -fx + 0.3 && X < fx - 0.3 && Z > fz0 + 0.3 && Z < fz1 - 0.3) { setNotice('큰 밭 안에는 놓을 수 없어요'); return }
      if (Z > fz1 - 1 && Math.abs(X - cafeRoadX(Z)) < 2.2) { setNotice('길 위에는 놓을 수 없어요'); return }
      // 고른 울타리가 있으면 그 울타리를 여기로 옮긴다(코인 없이)
      const from = pickedFenceRef.current
      if (from) {
        if (actFarm({ type: 'movefence', from, x: X, z: Z, r }) === 'saved') { playTap(); setNotice('울타리를 옮겼어요 🪵'); setPickedFence(null) } else setNotice('여기에는 이미 울타리가 있어요')
        return
      }
      if (getFarm().coins < FENCE_PRICE) { setNotice('코인이 모자라요'); return }
      if (getFarm().fences.some(([fx2, fz2, fr]) => fx2 === X && fz2 === Z && fr === r)) { setNotice('여기에는 이미 울타리가 있어요'); return }
      // 살지 먼저 물어본다(아래 창에서 「사기」를 누르면 설치)
      playTap(); setBuyFence({ x: X, z: Z, r })
    }
    fenceLine(-fx, fz0, fx, fz0); fenceLine(-fx, fz1, fx, fz1, 0); fenceLine(-fx, fz0, -fx, fz1); fenceLine(fx, fz0, fx, fz1)
    // 옆 울타리 밭 울타리(앞에 문)
    const sx1 = SIDE_X + (SIDE_COLS * (PW + GAP)) / 2 + 1.2
    // 옆 밭은 확장 모드에서 원하는 곳에 놓으니 울타리는 두르지 않는다(이 자리는 나무를 비워 둔다)

    // 헛간·집·우리 동물: 받은 3D 그림(public/farm/3d)을 세운 판(늘 카메라를 본다)
    const art = (name: string, h: number, aspect: number, x: number, z: number) => {
      const d = w.paperDoll(w.texOf(assetUrl(`farm/3d/${name}.webp`)), h, aspect)
      d.root.position.set(x, 0, z)
      return d
    }
    const buildings = [art('barn', 5, 1041 / 1085, -fx - 5, -6), art('house', 5.6, 1018 / 1188, -5, -fz1 - 14)]
    for (const d of buildings) w.obstacles.push({ x: d.root.position.x, z: d.root.position.z, r: 2.4 })
    // 동물 우리: 헛간 앞 울타리 안에서 젖소·양·닭이 거닌다
    PEN = { x0: -fx - 11, x1: -fx - 2, z0: fz1 - 3, z1: fz1 + 5 }
    fenceLine(PEN.x0, PEN.z0, PEN.x1, PEN.z0); fenceLine(PEN.x0, PEN.z1, PEN.x1, PEN.z1); fenceLine(PEN.x0, PEN.z0, PEN.x0, PEN.z1); fenceLine(PEN.x1, PEN.z0, PEN.x1, PEN.z1)
    w.obstacles.push({ x: (PEN.x0 + PEN.x1) / 2, z: (PEN.z0 + PEN.z1) / 2, r: 4.4 })
    const inPen = () => ({ x: PEN.x0 + 1 + rnd() * (PEN.x1 - PEN.x0 - 2), z: PEN.z0 + 1 + rnd() * (PEN.z1 - PEN.z0 - 2) })
    const animals = ([['cow', 1.7, 966 / 1150], ['sheep', 1.4, 989 / 1135], ['hen', 0.95, 895 / 1079], ['hen', 0.9, 895 / 1079]] as const).map(([n, h, a]) => {
      const p = inPen()
      const doll = art(n, h, a, p.x, p.z)
      w.pickables.push(doll.root)
      return { doll, good: (n === 'cow' ? 'milk' : n === 'hen' ? 'egg' : null) as AnimalGood | null, x: p.x, z: p.z, tx: p.x, tz: p.z, wait: rnd() * 3, dir: 1 as 1 | -1, t: rnd() * 5, speed: n === 'hen' ? 1.4 : 0.8 }
    })
    penned = animals
    // 우유·달걀 표시: 젖소와 첫 닭 머리 위. 받을 수 있으면 통통 뛰고, 기다리는 동안은 흐리게
    const goodTag = (g: AnimalGood) => { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: w.texOf(assetUrl(`kitchen/ing/${g}.webp`)), transparent: true, depthWrite: false }))); sp.scale.setScalar(0.8); scene.add(sp); return sp }
    const tags = [{ a: animals[0], sp: goodTag('milk'), g: 'milk' as AnimalGood, top: 2.1 }, { a: animals[2], sp: goodTag('egg'), g: 'egg' as AnimalGood, top: 1.4 }]
    // 노점: 길가 오른쪽. 여덟 방향 그림 중 보는 방향에 맞는 한 장(viewSprite3d). 받은 그림 6장 + 비스듬한 두 방향은 뒤집어서
    const sv = (n: string) => `farm/3d/stall/${n}.webp`
    const stallView = viewSprite(w, [
      [sv('v0'), 451 / 443, false], [sv('v1'), 709 / 662, false], [sv('v2'), 271 / 448, false], [sv('v5'), 685 / 649, true],
      [sv('v4'), 418 / 440, false], [sv('v5'), 685 / 649, false], [sv('v6'), 295 / 448, false], [sv('v1'), 709 / 662, true],
    ], 3.3, [0.01, 0.01], 1.25) // 그림자는 없앤다(그림 판 아래로 비치면 떠 보였다), 판은 노점 앞 끝으로
    const sg = stallView.root
    // 자리: 소·닭 우리 바로 앞(+z) 옆
    const STALL = { x: (PEN.x0 + PEN.x1) / 2 + 1.5, z: PEN.z1 + 3.4 }
    sg.position.set(STALL.x, 0, STALL.z)
    sg.rotation.y = Math.PI / 2 // 앞면이 카페 가는 길 쪽(+x)을 보게(길에서 오면 앞모습이 보인다)
    scene.add(sg)
    w.pickables.push(sg)
    w.obstacles.push({ x: STALL.x, z: STALL.z, r: 1.7 })
    stallGroup = sg
    const orderTex = new Map<string, THREE.Texture>()
    const orderSp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })))
    orderSp.scale.setScalar(1)
    scene.add(orderSp)
    // 산책길로 가는 분홍 성: 카페 가는 길 왼쪽 앞. 문 앞까지 가면(또는 성을 누르면) 3D 산책으로
    const CASTLE = { x: -13, z: fz1 + 17 }
    const gate = w.addCastleGate(CASTLE.x, CASTLE.z, cafeRoadX(fz1 + 8), fz1 + 8)
    w.pickables.push(gate.root)
    const gateSign = w.paperDoll(w.texOf(signCanvas('🏰 산책길', '분홍 성으로')), 2, 1)
    gateSign.root.position.set(gate.x + 2.2, 0, gate.z)
    gateRef.current = gate
    // 나무: 카페와 같은 3D 나무 그림(world3d.addTree)
    let trees = 0
    for (let i = 0; i < 300 && trees < 60; i++) {
      const x = (rnd() - 0.5) * BOUNDS * 1.9, z = (rnd() - 0.5) * BOUNDS * 1.9
      if (x > PEN.x0 - 3 && x < sx1 + 4 && z > fz0 - 4 && z < PEN.z1 + 4) continue
      if (Math.abs(x - cafeRoadX(z)) < 4.5 && z > fz1) continue // 카페 가는 길
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 7 || (x < 0 && x > CASTLE.x - 3 && z > fz1 + 6 && z < CASTLE.z + 2)) continue // 분홍 성과 성 가는 길
      if (Math.hypot(x, z - CAFE_GATE - 3.6) < 5.5) continue // 길 끝 카페 가게
      if (Math.hypot(x - STALL.x, z - STALL.z) < 4.5) continue // 노점
      if (Math.hypot(x - buildings[1].root.position.x, z - buildings[1].root.position.z) < 5) continue
      if (w.obstacles.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 10)) continue
      w.addTree(x, z, 0.8 + rnd() * 0.7, meadowTree(rnd()))
      trees++
    }

    // 같이 농사짓는 친구(🐾 로 고른 친구): 쉴 때는 밭 둘레를 거닐고, 일이 생기면(lib/farmFriends) 그 밭 옆으로 가서 물을 주거나 수확한다
    type Friend = { g: number; doll: Doll; x: number; z: number; tx: number; tz: number; wait: number; dir: 1 | -1; t: number; tool: THREE.Sprite }
    let friends: Friend[] = []
    const toolMats = { water: keep(new THREE.SpriteMaterial({ map: w.texOf(assetUrl('assets/farm/can.webp')), transparent: true, depthWrite: false })), harvest: keep(new THREE.SpriteMaterial({ map: w.texOf(assetUrl('assets/farm/icon_basket.webp')), transparent: true, depthWrite: false })) }
    const makeFriends = () => {
      for (const f of friends) { scene.remove(f.doll.root); scene.remove(f.tool) }
      friends = getFarmFriends().map((g, k) => {
        const av = guestAvatar(g)
        const x = k ? fx - 1 : -fx + 1, z = fz1 + 1.5
        let doll: Doll
        if (av) {
          // 아바타 친구 그림은 옷을 합쳐 그린 뒤에 붙인다(그 전에는 빈 판)
          doll = w.paperDoll(w.texOf(document.createElement('canvas')), AVATAR_H, 1024 / 1536, FEET)
          renderFigure(guestLook(av.id), {}, av).then((cv) => { const m = doll.doll.material as THREE.MeshBasicMaterial; m.map = w.texOf(cv); m.needsUpdate = true }).catch(() => {})
        } else {
          const img = CALL_ANIMALS[g].img
          doll = w.paperDoll(w.texOf(animal3dUrl(img)), ANIMAL_H, animal3dAspect(img))
          doll.root.userData.tex = [w.texOf(animal3dUrl(img)), w.texOf(animal3dUrl(img, true))]
        }
        const tool = new THREE.Sprite(toolMats.water)
        tool.scale.setScalar(0.6)
        tool.visible = false
        scene.add(tool)
        return { g, doll, x, z, tx: x, tz: z, wait: rnd() * 2, dir: 1 as 1 | -1, t: 0, tool }
      })
    }
    makeFriends()
    let friendKey = getFarmFriends().join()
    const unsubFriends = subscribeFarmFriends(() => { const k = getFarmFriends().join(); if (k !== friendKey) { friendKey = k; makeFriends() } })

    // 물주기·수확 버튼(혼자 할 때, 또는 옆 밭): 아바타가 밭을 차례로 돌며 한다
    let choreId = 0, choreCur = -1
    choreRef.current = (kind, list) => {
      const id = ++choreId
      const next = (k: number) => {
        if (id !== choreId || k >= list.length) { if (id === choreId) choreCur = -1; return }
        const i = list[k], p = plotAt(i)
        busy.add(i)
        choreCur = i
        ledAt(choreLed, i)
        w.walkTo(p.x, p.z + PD / 2 + 0.6, () => window.setTimeout(() => {
          busy.delete(i)
          const plot = getFarm().plots[i]
          if (plot && (kind === 'water' ? plot.wateredAt === null : growth(plot, Date.now()) === 1)) applyRef.current({ type: kind, plot: i })
          next(k + 1)
        }, 250), 0.3)
      }
      next(0)
    }
    // 땅·밭을 직접 누르면 돌던 일은 멈춘다(가던 밭은 다시 누를 수 있게 풀어 둔다)
    el.addEventListener('pointerdown', () => { choreId++; if (choreCur >= 0) { busy.delete(choreCur); choreCur = -1 } })

    let repaint = 0
    // 카페 가는 길: 농장 문에서 앞(+z)으로 곧게, 문 옆에 표지판
    // 굽이굽이 흙길(산책길처럼), 끝에 카페 가게(여덟 방향 그림, 앞이 농장 쪽을 본다)
    const roadPts: [number, number][] = []
    // 카페 가게 밑까지(길이 가게와 이어지게)
    for (let z = fz1 + 0.3; z <= CAFE_GATE + 3.6; z += 1.5) roadPts.push([cafeRoadX(z), z])
    w.addCurvePath(roadPts, 3, 'start')
    const cafeShop = cafeShopSprite(w)
    cafeShop.root.position.set(0, 0, CAFE_GATE + 3.6)
    cafeShop.root.rotation.y = Math.PI
    scene.add(cafeShop.root)
    w.obstacles.push({ x: 0, z: CAFE_GATE + 3.6, r: 2.4 })
    const sign = w.paperDoll(w.texOf(signCanvas('☕ 카페', '이 길로 쭉')), 2.2, 1)
    sign.root.position.set(2.6, 0, fz1 + 1.6)
    w.obstacles.push({ x: 2.6, z: fz1 + 1.6, r: 0.4 })
    let leaving = false
    // 확장 모드 ＋ 자리: 빈 땅(큰 밭·길·나무·건물이 없는 곳)에 밭 크기 칸을 미리 정해 두고, 큰 밭에서 가까운 40곳만
    const freeAt = (x: number, z: number) =>
      Math.abs(x) <= BOUNDS - 3 && Math.abs(z) <= BOUNDS - 3 &&
      !(x > -fx - 0.5 && x < fx + 0.5 && z > fz0 - 0.5 && z < fz1 + 0.5) &&
      !(z > fz1 - 1 && Math.abs(x - cafeRoadX(z)) < 3.2) &&
      !w.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.5)
    const cand: { x: number; z: number; d: number }[] = []
    for (let c = -22; c <= 14; c++) for (let m = -13; m <= 12; m++) {
      const x = SIDE_X + c * (PW + GAP), z = -4 + (m + 0.5) * (PD + GAP)
      if (freeAt(x, z)) cand.push({ x, z, d: Math.hypot(x - 4, (z + 4) * 1.3) })
    }
    cand.sort((a, b) => a.d - b.d)
    const slotMat = keep(new THREE.MeshLambertMaterial({ color: 0xbfe9a8, transparent: true, opacity: 0.6 }))
    slots = cand.slice(0, 90).map((c, k) => { // 밭을 놓을 수 있는 자리 90곳
      const box = new THREE.Mesh(boxGeo, slotMat); box.position.set(c.x, 0.06, c.z); box.visible = false; scene.add(box)
      const hit = new THREE.Mesh(hitGeo, hitMat); hit.position.set(c.x, 0.7, c.z); scene.add(hit); slotOf.set(hit, k)
      const mark = new THREE.Sprite(iconMats.add); mark.position.set(c.x, 0.9, c.z); mark.scale.setScalar(1.1); mark.visible = false; scene.add(mark)
      return { x: c.x, z: c.z, box, hit, mark }
    })
    // 확장 모드일 때 빈 ＋ 자리만 보이고 누를 수 있다(옮기는 중인 밭이 있던 자리도 빈 자리로)
    let slotSig = ''
    const refreshSlots = () => {
      const st = getFarm(), on = placingRef.current && toolRef.current === 'plot', mv = movingRef.current
      const taken = Array.from({ length: PLOT_COUNT - MAIN_PLOTS }, (_, j) => MAIN_PLOTS + j).filter((i) => st.owned[i] && i !== mv).map(plotAt)
      const sig = `${on}|${toolRef.current}|${mv}|${taken.map((p) => `${p.x},${p.z}`).join(';')}`
      if (sig === slotSig) return
      slotSig = sig
      for (const sl of slots) {
        const free = on && !taken.some((p) => Math.abs(p.x - sl.x) < PW + 0.3 && Math.abs(p.z - sl.z) < PD + 0.3)
        sl.box.visible = free; sl.mark.visible = free
        const k = w.pickables.indexOf(sl.hit)
        if (free && k < 0) w.pickables.push(sl.hit)
        if (!free && k >= 0) w.pickables.splice(k, 1)
      }
    }
    w.onFrame((dt) => {
      w.face(sign, 1)
      if (!leaving && onCafeRef.current && w.me.z > CAFE_GATE) { leaving = true; setFade(true); window.setTimeout(() => onCafeRef.current?.(), 450) }
      w.face(gateSign, 1)
      if (!leaving && onWalkRef.current && !placingRef.current && Math.hypot(w.me.x - gate.x, w.me.z - gate.z) < 1.4) { leaving = true; setFade(true); window.setTimeout(() => onWalkRef.current?.(), 450) }
      repaint += dt
      // 옮기려고 고른 울타리에 초록 LED
      { const pf = pickedFenceRef.current; fenceLed.visible = !!pf && placingRef.current; if (pf) fenceLed.position.set(pf[0], 0.05, pf[1]); const f = pf && getFarm().fences.find(([x, z]) => x === pf[0] && z === pf[1]); if (f) fenceLed.rotation.y = f[2] ? Math.PI / 2 : 0 }
      refreshSlots()
      if (led.visible && ledUntil < performance.now() && !busy.has(ledPlot)) led.visible = false
      if (choreLed.visible && choreCur < 0) choreLed.visible = false
      ledMat.opacity = 0.55 + 0.4 * Math.abs(Math.sin(performance.now() / 160))
      if (repaint > 0.5) { repaint = 0; paint() } // 자라는 단계는 시간이 지나면 바뀐다
      for (const p of plots) if (p.mark.visible) p.mark.position.y = (p.mark.material === iconMats.lock ? 0.6 : 1.6) + Math.sin(performance.now() / 300 + p.box.position.x) * 0.12
      const jobs = getFriendJobs()
      friendLeds.forEach((g, k) => { const j = friends[k] && jobs[friends[k].g]; if (j) ledAt(g, j.plot); else g.visible = false })
      for (const f of friends) {
        f.t += dt
        const job = jobs[f.g]
        let moving = false
        if (job) {
          // 일하는 밭 옆(앞·왼쪽·오른쪽)으로 간다
          const p = plotAt(job.plot)
          f.tx = job.side === 'front' ? p.x : p.x + (job.side === 'left' ? -1 : 1) * (PW / 2 + 0.35)
          f.tz = job.side === 'front' ? p.z + PD / 2 + 0.5 : p.z
          f.wait = 0
        }
        if (f.wait > 0) f.wait -= dt
        else {
          const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz)
          if (d < 0.1) {
            if (!job) {
              f.wait = 1.5 + rnd() * 3
              const side = Math.floor(rnd() * 4)
              f.tx = side < 2 ? (rnd() - 0.5) * fx * 2 : (side === 2 ? -fx : fx) + (side === 2 ? 0.9 : -0.9)
              f.tz = side < 2 ? (side ? fz1 - 0.9 : fz0 + 0.9) : fz0 + rnd() * (fz1 - fz0)
            }
          } else {
            const sp = job ? 4 : 2.2, step = Math.min(d, sp * dt)
            f.x += (dx / d) * step; f.z += (dz / d) * step
            moving = true
            showBack(f.doll, walkingAway(dx, dz, f.x, f.z, w.camera.position.x, w.camera.position.z))
            const s2 = w.screenSide(dx, dz)
            if (Math.abs(s2) > 0.05) f.dir = s2 > 0 ? 1 : -1
          }
        }
        f.doll.root.position.set(f.x, 0, f.z)
        if (!moving) showBack(f.doll, false)
        f.doll.body.position.y = moving ? Math.abs(Math.sin(f.t * 8)) * 0.1 : 0
        w.face(f.doll, f.dir)
        // 들고 있는 물뿌리개·바구니(물 줄 때는 기울인다)
        f.tool.visible = !!job
        if (job) {
          f.tool.material = toolMats[job.kind]
          f.tool.position.set(f.x, 0.9 + (job.watering ? 0.15 : 0), f.z + 0.3)
          f.tool.material.rotation = job.kind === 'water' && job.watering ? -0.55 : 0
        }
      }
      // 우유·달걀 표시와 노점 주문 작물
      const fst = getFarm(), nowMs = Date.now()
      for (const tg of tags) {
        const wait = animalWait(fst, tg.g, nowMs)
        tg.sp.position.set(tg.a.x, tg.top + (wait === 0 ? Math.abs(Math.sin(nowMs / 220)) * 0.25 : 0), tg.a.z)
        tg.sp.material.opacity = wait === 0 ? 1 : 0.35 + 0.4 * (1 - wait / ANIMAL_SECONDS)
      }
      const oc = orderCrop(fst).id
      if (!orderTex.has(oc)) orderTex.set(oc, w.texOf(assetUrl(`assets/farm/harvest_${oc}.webp`)))
      if (orderSp.material.map !== orderTex.get(oc)) { orderSp.material.map = orderTex.get(oc)!; orderSp.material.needsUpdate = true }
      stallView.update(w.camera)
      cafeShop.update(w.camera)
      orderSp.position.set(STALL.x, 3.7 + Math.sin(nowMs / 400) * 0.1, STALL.z)
      for (const p of plots) for (const c of p.crops) if (c.root.visible) w.face(c, 1)
      for (const d of buildings) w.face(d, 1)
      // 우리 동물: 우리 안 아무 데나 천천히 걸어갔다가 쉬었다가
      for (const a of animals) {
        a.t += dt
        if (a.wait > 0) a.wait -= dt
        else {
          const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz)
          if (d < 0.1) { a.wait = 1.5 + rnd() * 3.5; const p = inPen(); a.tx = p.x; a.tz = p.z }
          else {
            a.x += (dx / d) * a.speed * dt; a.z += (dz / d) * a.speed * dt
            const sd = w.screenSide(dx, dz)
            if (Math.abs(sd) > 0.05) a.dir = sd > 0 ? 1 : -1 // 그림은 오른쪽을 본다(꼬리가 왼쪽)
          }
        }
        a.doll.root.position.set(a.x, 0, a.z)
        a.doll.body.position.y = a.wait > 0 ? 0 : Math.abs(Math.sin(a.t * 9)) * 0.08
        w.face(a.doll, a.dir)
      }
    })
    return () => { cleanups.forEach((f) => f()); detachMp(); bossRef.current = null; unsub(); unsubFriends(); unsubFence(); w.dispose(); world.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- 처음 한 번만 만든다(arrive 는 처음 자리만 정한다)

  useEffect(() => {
    let alive = true
    renderFigure(outfit, tweaks).then((cv) => { if (alive) world.current?.setAvatar(cv) }).catch(() => setReady(true))
    return () => { alive = false }
  }, [outfit, tweaks])

  return (
    <section aria-label="3D 농장" className="relative h-full overflow-hidden rounded-3xl bg-[#bfe6ff] select-none">
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#3d6b2f] shadow">🌱 3D 농장</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <span className="rounded-full bg-white/95 px-3 py-2 text-sm font-black shadow"><CoinIcon /> {farm.coins}</span>
          {/* 🦅 위: 하늘에서 내려다보며 밭·울타리를 배치한다(한 번 더 누르면 돌아온다) */}
          <button aria-label="위에서 보기" aria-pressed={placing} onClick={() => { playTap(); setSeedOpen(false); if (placing) endPlacing(); else setPlacing(true) }} className={`h-10 rounded-full px-3 text-sm font-black shadow ${placing ? 'bg-[#5cc46a] text-white' : 'bg-white/95 text-[#3d6b2f]'}`}>🦅 위</button>
          {/* 같이 농사지을 친구 고르기(고른 친구 얼굴, 혼자면 🐾) */}
          <button aria-label="같이 농사지을 친구" onClick={() => { playTap(); setPicking(true) }} className="flex h-10 items-center rounded-full bg-white/95 px-2.5 shadow">
            {friendsNow.length ? friendsNow.map((f) => <img key={f} src={assetUrl(guestFace(f))} alt="" draggable={false} className="-mx-0.5 h-7 w-7 object-contain" />) : <span className="text-lg">🐾</span>}
          </button>
          <button aria-label="닫기" onClick={onExit} className="h-10 w-10 rounded-full bg-white/95 text-lg font-bold shadow">✕</button>
        </div>
      </div>
      {/* 도구 4개(아래): 세로 화면은 한 줄(1×4), 가로 화면은 오른쪽 아래 2×2. 씨앗을 누르면 위에 씨앗 고르기 칸 */}
      {!placing && !bossUi?.fight && (
        <div className="absolute inset-x-2 bottom-2 z-10 mx-auto flex max-w-[26rem] flex-col items-stretch gap-1.5 landscape:inset-x-auto landscape:right-2 landscape:mx-0 landscape:w-56">
          {seedOpen && (
            <div role="radiogroup" aria-label="심을 씨앗" className="flex justify-center gap-2 rounded-3xl bg-white/95 p-2 shadow-lg">
              {CROPS.map((c) => (
                <button key={c.id} role="radio" aria-checked={seed === c.id} aria-label={`${c.ko} 씨앗 ${farm.inventory[c.id]}개`} onClick={() => { playTap(); setSeed(c.id); setSeedOpen(false) }}
                  className={`flex flex-1 flex-col items-center rounded-2xl p-1 ${seed === c.id ? 'bg-petal ring-2 ring-blush' : ''}`}>
                  <img src={assetUrl(`assets/farm/harvest_${c.id}.webp`)} alt="" draggable={false} className="h-11 w-11 object-contain landscape:h-8 landscape:w-8" />
                  <span className="mt-0.5 rounded-full bg-[#fdf2d8] px-2 text-xs font-extrabold text-[#6b4a2b]">×{farm.inventory[c.id]}</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-4 gap-1.5 landscape:grid-cols-2">
            {([['seed', '씨앗', 'icon_seed'], ['water', '물주기', 'icon_water'], ['harvest', '수확', 'icon_basket'], ['kitchen', '주방', 'icon_kitchen']] as const).map(([id, label, icon]) => (
              <button key={id} aria-label={label} aria-pressed={id === 'seed' ? seedOpen : undefined}
                onClick={() => { if (id === 'seed') { playTap(); setSeedOpen((o) => !o) } else if (id === 'kitchen') { playTap(); onKitchen?.() } else { setSeedOpen(false); doChore(id) } }}
                className={`relative flex flex-col items-center rounded-2xl border-2 py-1 shadow ${id === 'seed' && seedOpen ? 'border-blush bg-[#fff1cc]' : 'border-[#e5cfa3] bg-[#fdf2d8]/95'}`}>
                <img src={assetUrl(`assets/farm/${icon}.webp`)} alt="" draggable={false} className="h-9 w-9 object-contain landscape:h-7 landscape:w-7" />
                <span className="text-xs font-extrabold text-[#6b4a2b]">{label}</span>
                {/* 씨앗 단추에는 지금 고른 씨앗을 작게 */}
                {id === 'seed' && <img src={assetUrl(`assets/farm/harvest_${seed}.webp`)} alt="" draggable={false} className="absolute -top-1.5 -right-1 h-6 w-6 object-contain drop-shadow" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* 확장 모드: 옆 밭을 원하는 곳에 설치·옮기기 */}
      {placing && (
        <div className="absolute inset-x-2 bottom-4 z-20 mx-auto flex w-fit max-w-full flex-col items-center gap-1.5">
          <p className="m-0 rounded-2xl bg-white/95 px-3 py-2 text-center text-sm font-extrabold text-[#3d6b2f] shadow">
            {tool === 'plot' ? <>🪴 확장 · 옆 밭 {farm.owned.filter((o, k) => o && k >= MAIN_PLOTS).length}/20</> : <>🪵 울타리 {farm.fences.length}칸 · 한 칸 {FENCE_PRICE} <CoinIcon /></>}<br />
            <span className="text-xs font-bold text-black/60">{tool === 'fence' ? (pickedFence ? '옮길 곳의 땅을 누르거나 ↔↕ 로 방향 바꾸기 (한 번 더 누르면 취소)' : '땅을 누르면 한 칸 설치 · 울타리를 꾹 누르고 끌면 옮기기') : moving !== null ? '옮길 ＋ 자리를 눌러요 (밭을 한 번 더 누르면 취소)' : <>＋ 자리를 누르면 설치 · {plotPrice(farm)} <CoinIcon /> · 설치한 밭을 누르면 옮기기</>}</span>
          </p>
          <div className="flex gap-1.5">
            <button aria-pressed={tool === 'plot'} onClick={() => { playTap(); setTool('plot'); setMoving(null); setPickedFence(null) }} className={`h-10 rounded-full px-3 text-sm font-black shadow ${tool === 'plot' ? 'bg-[#5cc46a] text-white' : 'bg-white/95'}`}>🪴 밭</button>
            <button aria-pressed={tool === 'fence'} onClick={() => { playTap(); setTool('fence'); setMoving(null) }} className={`h-10 rounded-full px-3 text-sm font-black shadow ${tool === 'fence' ? 'bg-[#c98d55] text-white' : 'bg-white/95'}`}>🪵 울타리</button>
            {tool === 'fence' && pickedFence && <button onClick={() => { if (actFarm({ type: 'unfence', x: pickedFence[0], z: pickedFence[1] }) === 'saved') { playTap(); setNotice('울타리를 치웠어요') } setPickedFence(null) }} className="h-10 rounded-full bg-white/95 px-3 text-sm font-black text-[#d0587a] shadow">🗑 치우기</button>}
            {tool === 'fence' && <button aria-label="울타리 방향" onClick={() => { playTap(); if (pickedFence) { const f = farm.fences.find(([x, z]) => x === pickedFence[0] && z === pickedFence[1]); if (f) { const nr = f[2] ? 0 : 1; if (actFarm({ type: 'movefence', from: pickedFence, x: f[0], z: f[1], r: nr }) === 'saved') setNotice('울타리 방향을 바꿨어요') } } else setFenceDir((d) => (d ? 0 : 1)) }} className="h-10 rounded-full bg-white/95 px-3 text-sm font-black shadow">{fenceDir ? '↕ 세로' : '↔ 가로'}</button>}
          </div>
          <div className="flex gap-1.5">
            <button aria-label="크게 보기" onClick={() => { playTap(); zoomBy(0.75) }} className="h-10 w-10 rounded-full bg-white/95 text-xl font-black shadow">＋</button>
            <button aria-label="작게 보기" onClick={() => { playTap(); zoomBy(1.33) }} className="h-10 w-10 rounded-full bg-white/95 text-xl font-black shadow">－</button>
            <button onClick={() => { playTap(); endPlacing() }} className="h-10 rounded-full bg-[#ff8fab] px-4 text-sm font-black text-white shadow">✓ 다 했어요</button>
          </div>
        </div>
      )}
      {notice && <p role="status" className="absolute top-14 left-1/2 z-20 m-0 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-center text-sm font-bold whitespace-nowrap shadow">{notice}</p>}
      {!ready && <p className="absolute inset-0 z-20 m-0 flex items-center justify-center text-sm font-bold text-[#3d6b2f]">농장을 만드는 중…</p>}
      {!placing && <BossHud ui={bossUi} done={bossDone} onGo={() => bossRef.current?.go()} onZap={() => bossRef.current?.zapWeapon()} onRest={() => bossRef.current?.rest()} onCloseDone={() => setBossDone(null)} />}
      {/* 울타리 사기: 살지 물어본다 */}
      {buyFence && placing && (
        <div role="dialog" aria-label="울타리 사기" className="absolute top-1/3 left-1/2 z-30 flex w-max max-w-[96%] -translate-x-1/2 flex-col items-center gap-2 rounded-3xl bg-white/95 p-3 shadow-lg">
          <p className="m-0 text-sm font-extrabold text-[#6b4a2b]">🪵 울타리 한 칸을 {FENCE_PRICE} <CoinIcon /> 에 살까요?</p>
          <p className="m-0 text-xs font-bold text-black/50">지금 <CoinIcon /> {farm.coins} · {buyFence.r ? '↕ 세로' : '↔ 가로'}</p>
          <div className="flex gap-2">
            <button onClick={confirmFence} className="h-10 rounded-full bg-[#5cc46a] px-5 text-sm font-black text-white shadow">사기</button>
            <button onClick={() => { playTap(); setBuyFence(null) }} className="h-10 rounded-full bg-[#f3e6ea] px-5 text-sm font-bold">아니요</button>
          </div>
        </div>
      )}
      {/* 카페 길을 넘어갈 때 하얗게 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-white transition-opacity duration-500" style={{ opacity: fade ? 1 : 0 }} />
      {/* 아직 못 산 밭: 코인으로 사기 */}
      {buying !== null && (
        <div role="dialog" aria-label="밭 사기" className="absolute top-1/3 left-1/2 z-30 flex w-max max-w-[96%] -translate-x-1/2 items-center gap-2 rounded-3xl bg-white/95 p-3 whitespace-nowrap shadow-lg">
          <span className="text-sm font-extrabold">{buying >= MAIN_PLOTS ? '옆 밭 설치' : '새 밭'} · {plotPrice(farm)} <CoinIcon /></span>
          <button className="min-h-11 rounded-2xl bg-[#ff8fab] px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={farm.coins < plotPrice(farm)} onClick={() => { if (apply({ type: 'buy', plot: buying })) setNotice('새 밭이 생겼어요! 🌱'); setBuying(null) }}>{buying >= MAIN_PLOTS ? '설치하기' : '사기'}</button>
          <button className="min-h-11 rounded-2xl bg-[#ffe4ec] px-3 py-2 text-sm font-bold" onClick={() => setBuying(null)}>아니요</button>
          {farm.coins < plotPrice(farm) && <span className="text-xs font-bold text-[#d0587a]">코인이 모자라요</span>}
        </div>
      )}
      {stall && <div className="absolute inset-0 z-40"><FarmStall apply={apply} notice={notice ?? ''} onClose={() => setStall(false)} /></div>}
      {picking && (
        <div className="absolute inset-0 z-40">
          <PartyInvite here={[]} initial={friendsNow} max={MAX_FARM_FRIENDS} allowNone title="🌱 누구랑 같이 농사지을까요?" locked={notCollected(meet)} avatars={{ me: getAvatar().id }} note={`아바타 친구와 수학으로 모은 동물 친구 중 ${MAX_FARM_FRIENDS}명까지 골라요 · 친구가 물 주고 수확해요 · 아무도 안 고르면 혼자 해요`}
            cta="🌱 같이 하기" ctaNone="🙋 혼자 할래요" onClose={() => setPicking(false)} onInvite={(a, looks) => { setPicking(false); setGuestLooks(looks); setFarmFriends(a) }} />
        </div>
      )}
    </section>
  )
}
