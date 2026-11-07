import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { getAvatar } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import { ANIMAL_SECONDS, CROPS, MAIN_PLOTS, PLOT_COUNT, actFarm, animalWait, getFarm, growth, orderCrop, plotPrice, subscribeFarm, type AnimalGood, type CropId, type FarmAction } from '../lib/farm'
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
import { GuestDresser } from './GuestDresser'
import { FarmStall } from './FarmStall'
import { PartyInvite } from './PartyGuests'
import { viewSprite } from './viewSprite3d'
import { ANIMAL_H, AVATAR_H, FEET, createWorld, meadowTree, emojiCanvas, signCanvas, type Doll, type World } from './world3d'

/**
 * 3D 농장 (시험판): 큰 밭 20칸과 옆 울타리 밭 8칸(농장 탭과 같은 밭·같은 저장)을 3D 들판에 깔고, 아바타가 걸어가서 심고·물 주고·수확한다.
 * 밭을 누르면 그 밭이 필요로 하는 일(심기 → 물주기 → 다 자라면 수확)을 한다. 작물은 농장 그림을 세운 종이 인형.
 * 같이 농사짓는 동물 친구는 밭 둘레를 거닌다(물 주기는 농장 탭처럼 친구들이 따로 한다).
 */
const COLS = 5, ROWS = 4
const PW = 2.6, PD = 2.0, GAP = 0.7
const BOUNDS = 40
/** 옆 울타리 밭(20~27번): 큰 밭 오른쪽 옆 땅에 4칸×2줄 */
const SIDE_COLS = 4
const SIDE_X = (COLS * (PW + GAP)) / 2 + 1.2 + 4 + (SIDE_COLS * (PW + GAP)) / 2 + 1.2
/** 작물 그림 크기(가로·세로 px) */
const CROP_BOX: Record<CropId, [number, number]> = { carrot: [568, 499], strawberry: [578, 453], corn: [505, 619] }
const stageOf = (wateredAt: number | null, progress: number) => (wateredAt === null ? 1 : progress >= 1 ? 4 : progress < 0.4 ? 2 : 3)
/** 밭 자리: 처음부터 내 밭인 앞 칸(0~8)이 들어오는 문(앞쪽, +z) 가까이 오게 줄 번호가 클수록 뒤로 */
const plotAt = (i: number) => {
  if (i >= MAIN_PLOTS) { const j = i - MAIN_PLOTS; return { x: SIDE_X + ((j % SIDE_COLS) - (SIDE_COLS - 1) / 2) * (PW + GAP), z: -(Math.floor(j / SIDE_COLS) - 0.5) * (PD + GAP) - 4 } }
  return { x: ((i % COLS) - (COLS - 1) / 2) * (PW + GAP), z: -(Math.floor(i / COLS) - (ROWS - 1) / 2) * (PD + GAP) - 4 }
}

/** 카페 가는 길: 농장 문(앞쪽, +z)에서 굽이굽이 뻗고, 길 끝 카페 가게 앞(CAFE_GATE)까지 가면 카페로 넘어간다 */
const CAFE_GATE = 34
/** 카페 가는 길이 지나는 x(z 에 따라 좌우로 굽이친다, 양 끝은 가운데) */
const cafeRoadX = (z: number) => { const u = Math.max(0, Math.min(1, (z - 7) / (CAFE_GATE - 7))); return Math.sin(u * Math.PI * 2) * 3.2 * Math.sin(u * Math.PI) }
export function Farm3D({ outfit, tweaks, onOutfit, onExit, arrive = false, onCafe, onKitchen }: {
  outfit: Outfit; tweaks: Tweaks; onOutfit: (next: Outfit) => void; onExit: () => void
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
  onCafeRef.current = onCafe
  const [seed, setSeed] = useState<CropId>('strawberry')
  const seedRef = useRef(seed)
  seedRef.current = seed
  const [notice, setNotice] = useState<string | null>(null)
  const [dressing, setDressing] = useState(false)
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 2200); return () => clearTimeout(t) }, [notice])
  // 2D 농장과 같은 것들: 밭 사기, 노점, 우유·달걀, 같이 농사짓는 친구, 물주기·수확 버튼, 주방
  const [buying, setBuying] = useState<number | null>(null)
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
    // 친구가 있으면 큰 밭은 친구들이, 옆 밭은 내가
    let mine = all
    if (friendsNow.length && all.some((i) => i < MAIN_PLOTS)) {
      if (kind === 'water') waterNow(); else harvestAll(now)
      mine = all.filter((i) => i >= MAIN_PLOTS)
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
    const w = createWorld(el, {
      bounds: BOUNDS, start: arrive ? { x: cafeRoadX(CAFE_GATE - 7), z: CAFE_GATE - 7 } : { x: 0, z: 6 }, seed: 11, grass: assetUrl('cafe/3d/grass.webp'), onReady: () => setReady(true),
      // 밭을 누르면 밭 앞까지 걸어가서 그 밭이 필요로 하는 일을 한다
      onPick: (o) => {
        // 노점·우리 동물
        if (o === stallGroup) { w.walkTo(stallGroup.position.x, stallGroup.position.z + 1.6, () => setStall(true), 0.4); return }
        const an = penned.find((a) => a.doll.root === o)
        if (an) {
          if (!an.good) { setNotice('메에~ 🐑 털이 보송보송해요'); return }
          const g = an.good
          w.walkTo((PEN.x0 + PEN.x1) / 2, (PEN.z0 + PEN.z1) / 2, () => collectRef.current(g), 5.3)
          return
        }
        const i = plotOf.get(o)
        if (i === undefined || busy.has(i)) return
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
    const { scene, rnd, keep, lambert } = w

    // 밭 20칸: 흙 상자(마른 흙·젖은 흙·아직 못 산 밭은 풀빛) + 작물 둘 + 표시(💧 물 필요, ✨ 다 자람, 🔒 잠김)
    const boxGeo = keep(new THREE.BoxGeometry(PW, 0.22, PD))
    const ridgeGeo = keep(new THREE.BoxGeometry(PW * 0.92, 0.08, 0.16))
    const dryMat = lambert(0xc4935f), wetMat = lambert(0x7d5234), lockedMat = lambert(0xa9cf86), ridgeDry = lambert(0xb07e4c), ridgeWet = lambert(0x6a4329)
    const icon = (s: string) => keep(new THREE.SpriteMaterial({ map: w.texOf(emojiCanvas(s)), transparent: true, depthWrite: false }))
    const iconMats = { water: icon('💧'), ready: icon('✨'), lock: icon('🔒') }
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
      const ridges = [-0.5, 0, 0.5].map((dz) => { const r = new THREE.Mesh(ridgeGeo, ridgeDry); r.position.set(p.x, 0.25, p.z + dz); scene.add(r); return r })
      scene.add(box)
      plotOf.set(box, i)
      w.pickables.push(box)
      const crops = [-0.6, 0.6].map((dx) => {
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
      return { box, ridges, crops, mark, key: '' }
    })
    // 지금 밭 상태대로 다시 칠한다(바뀐 칸만)
    const paint = () => {
      const st = getFarm(), now = Date.now()
      plots.forEach((v, i) => {
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
            const [bw, bh] = CROP_BOX[plot.crop], h = (plot.crop === 'corn' ? 1.9 : 1.5) * (stage === 1 ? 0.75 : stage === 2 ? 0.85 : 1)
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
    fenceLine(-fx, fz0, fx, fz0); fenceLine(-fx, fz1, fx, fz1, 0); fenceLine(-fx, fz0, -fx, fz1); fenceLine(fx, fz0, fx, fz1)
    // 옆 울타리 밭 울타리(앞에 문)
    const sx0 = SIDE_X - (SIDE_COLS * (PW + GAP)) / 2 - 1.2, sx1 = SIDE_X + (SIDE_COLS * (PW + GAP)) / 2 + 1.2
    const sz0 = -4 - (PD + GAP) - 1.2, sz1 = -4 + (PD + GAP) + 1.2
    fenceLine(sx0, sz0, sx1, sz0); fenceLine(sx0, sz1, sx1, sz1, SIDE_X); fenceLine(sx0, sz0, sx0, sz1); fenceLine(sx1, sz0, sx1, sz1)

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
    scene.add(sg)
    w.pickables.push(sg)
    w.obstacles.push({ x: STALL.x, z: STALL.z, r: 1.7 })
    stallGroup = sg
    const orderTex = new Map<string, THREE.Texture>()
    const orderSp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })))
    orderSp.scale.setScalar(1)
    scene.add(orderSp)
    // 나무: 카페와 같은 3D 나무 그림(world3d.addTree)
    let trees = 0
    for (let i = 0; i < 300 && trees < 60; i++) {
      const x = (rnd() - 0.5) * BOUNDS * 1.9, z = (rnd() - 0.5) * BOUNDS * 1.9
      if (x > PEN.x0 - 3 && x < sx1 + 4 && z > fz0 - 4 && z < PEN.z1 + 4) continue
      if (Math.abs(x - cafeRoadX(z)) < 4.5 && z > fz1) continue // 카페 가는 길
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
        } else doll = w.paperDoll(w.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[g].img}_stand.webp`)), ANIMAL_H, 1)
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
    let choreId = 0
    choreRef.current = (kind, list) => {
      const id = ++choreId
      const next = (k: number) => {
        if (id !== choreId || k >= list.length) return
        const i = list[k], p = plotAt(i)
        busy.add(i)
        w.walkTo(p.x, p.z + PD / 2 + 0.6, () => window.setTimeout(() => {
          busy.delete(i)
          const plot = getFarm().plots[i]
          if (plot && (kind === 'water' ? plot.wateredAt === null : growth(plot, Date.now()) === 1)) applyRef.current({ type: kind, plot: i })
          next(k + 1)
        }, 250), 0.3)
      }
      next(0)
    }
    el.addEventListener('pointerdown', () => { choreId++ }) // 땅·밭을 직접 누르면 돌던 일은 멈춘다

    let repaint = 0
    // 카페 가는 길: 농장 문에서 앞(+z)으로 곧게, 문 옆에 표지판
    // 굽이굽이 흙길(산책길처럼), 끝에 카페 가게(여덟 방향 그림, 앞이 농장 쪽을 본다)
    const roadPts: [number, number][] = []
    // 카페 가게 밑까지(길이 가게와 이어지게)
    for (let z = fz1 + 0.3; z <= CAFE_GATE + 3.6; z += 1.5) roadPts.push([cafeRoadX(z), z])
    w.addCurvePath(roadPts, 3)
    const cv = (n: string) => `cafe/3d/shop/${n}.webp`
    const cafeShop = viewSprite(w, [
      [cv('v0'), 1155 / 1186, false], [cv('v1'), 1164 / 1198, false], [cv('v2'), 692 / 1183, false], [cv('v3'), 1110 / 1149, false],
      [cv('v4'), 1155 / 1186, false], [cv('v3'), 1110 / 1149, true], [cv('v6'), 732 / 1189, false], [cv('v7'), 1148 / 1197, false],
    ], 5.8, [2.1, 1.5], 1.5)
    cafeShop.root.position.set(0, 0, CAFE_GATE + 3.6)
    cafeShop.root.rotation.y = Math.PI
    scene.add(cafeShop.root)
    w.obstacles.push({ x: 0, z: CAFE_GATE + 3.6, r: 2.4 })
    const sign = w.paperDoll(w.texOf(signCanvas('☕ 카페', '이 길로 쭉')), 2.2, 1)
    sign.root.position.set(2.6, 0, fz1 + 1.6)
    w.obstacles.push({ x: 2.6, z: fz1 + 1.6, r: 0.4 })
    let leaving = false
    w.onFrame((dt) => {
      w.face(sign, 1)
      if (!leaving && onCafeRef.current && w.me.z > CAFE_GATE) { leaving = true; setFade(true); window.setTimeout(() => onCafeRef.current?.(), 450) }
      repaint += dt
      if (repaint > 0.5) { repaint = 0; paint() } // 자라는 단계는 시간이 지나면 바뀐다
      for (const p of plots) if (p.mark.visible) p.mark.position.y = (p.mark.material === iconMats.lock ? 0.6 : 1.6) + Math.sin(performance.now() / 300 + p.box.position.x) * 0.12
      const jobs = getFriendJobs()
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
            const s2 = w.screenSide(dx, dz)
            if (Math.abs(s2) > 0.05) f.dir = s2 > 0 ? 1 : -1
          }
        }
        f.doll.root.position.set(f.x, 0, f.z)
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
    return () => { unsub(); unsubFriends(); w.dispose(); world.current = null }
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
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#3d6b2f] shadow">🌱 3D 농장 <span className="text-xs font-bold text-black/40">시험판</span></span>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <span className="rounded-full bg-white/95 px-3 py-2 text-sm font-black shadow"><CoinIcon /> {farm.coins}</span>
          <button aria-label="옷 갈아입기" onClick={() => { playTap(); setDressing(true) }} className="h-10 rounded-full bg-white/95 px-3 text-sm font-black text-[#8a4b55] shadow">👗 옷</button>
          {/* 같이 농사지을 친구 고르기(고른 친구 얼굴, 혼자면 🐾) */}
          <button aria-label="같이 농사지을 친구" onClick={() => { playTap(); setPicking(true) }} className="flex h-10 items-center rounded-full bg-white/95 px-2.5 shadow">
            {friendsNow.length ? friendsNow.map((f) => <img key={f} src={assetUrl(guestFace(f))} alt="" draggable={false} className="-mx-0.5 h-7 w-7 object-contain" />) : <span className="text-lg">🐾</span>}
          </button>
          <button aria-label="닫기" onClick={onExit} className="h-10 w-10 rounded-full bg-white/95 text-lg font-bold shadow">✕</button>
        </div>
      </div>
      {/* 심을 씨앗 고르기 */}
      <div role="radiogroup" aria-label="심을 씨앗" className="absolute inset-x-0 bottom-10 z-10 mx-auto flex w-fit max-w-[calc(100%-1rem)] gap-0.5 rounded-full bg-white/90 p-1 whitespace-nowrap shadow portrait:bottom-14">
        {CROPS.map((c) => (
          <button key={c.id} role="radio" aria-checked={seed === c.id} aria-label={`${c.ko} 씨앗`} onClick={() => { playTap(); setSeed(c.id) }}
            className={`flex h-11 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[12.5px] font-black sm:px-2 sm:text-sm whitespace-nowrap ${seed === c.id ? 'bg-[#ff8fab] text-white' : 'text-[#6b4a2b]'}`}>
            <img src={assetUrl(`assets/farm/harvest_${c.id}.webp`)} alt="" className="h-7 w-7 object-contain sm:h-6 sm:w-6" /><span className="hidden sm:inline">{c.ko}</span>
            {/* 지금 가진 수 */}
            <span className={`rounded-full px-1 text-[10px] font-extrabold ${seed === c.id ? 'bg-white/30' : 'bg-[#fdf2d8]'}`}>×{farm.inventory[c.id]}</span>
          </button>
        ))}
      </div>
      {/* 도구: 물주기·수확(친구가 있으면 큰 밭은 친구들이), 노점, 주방 */}
      <div className="absolute top-16 right-2 bottom-24 z-10 flex flex-col justify-end gap-1.5 landscape:bottom-9">
        {([['water', '물주기', 'icon_water'], ['harvest', '수확', 'icon_basket'], ['stall', '노점', ''], ['kitchen', '주방', 'icon_kitchen']] as const).map(([id, label, icon]) => (
          <button key={id} aria-label={label} onClick={() => { if (id === 'water' || id === 'harvest') doChore(id); else if (id === 'stall') { playTap(); setStall(true) } else { playTap(); onKitchen?.() } }}
            className="flex w-14 flex-col items-center rounded-2xl border-2 border-[#e5cfa3] bg-[#fdf2d8]/95 py-1 shadow">
            {icon ? <img src={assetUrl(`assets/farm/${icon}.webp`)} alt="" draggable={false} className="h-8 w-8 object-contain" /> : <span className="flex h-8 items-center text-2xl">🧺</span>}
            <span className="text-[11px] font-extrabold text-[#6b4a2b]">{label}</span>
          </button>
        ))}
      </div>
      <p className="pointer-events-none absolute inset-x-2 bottom-3 z-10 m-0 text-center text-xs font-bold text-[#3d6b2f] drop-shadow-[0_1px_0_white]">밭을 누르면 심고 · 💧 물 주고 · ✨ 수확해요 · 젖소·닭을 누르면 우유·달걀 · 옆으로 끌면 둘러봐요</p>
      {notice && <p role="status" className="absolute top-14 left-1/2 z-20 m-0 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-center text-sm font-bold whitespace-nowrap shadow">{notice}</p>}
      {!ready && <p className="absolute inset-0 z-20 m-0 flex items-center justify-center text-sm font-bold text-[#3d6b2f]">농장을 만드는 중…</p>}
      {/* 카페 길을 넘어갈 때 하얗게 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-white transition-opacity duration-500" style={{ opacity: fade ? 1 : 0 }} />
      {/* 아직 못 산 밭: 코인으로 사기 */}
      {buying !== null && (
        <div role="dialog" aria-label="밭 사기" className="absolute top-1/3 left-1/2 z-30 flex w-max max-w-[96%] -translate-x-1/2 items-center gap-2 rounded-3xl bg-white/95 p-3 whitespace-nowrap shadow-lg">
          <span className="text-sm font-extrabold">{buying >= MAIN_PLOTS ? '옆 밭' : '새 밭'} · {plotPrice(farm)} <CoinIcon /></span>
          <button className="min-h-11 rounded-2xl bg-[#ff8fab] px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={farm.coins < plotPrice(farm)} onClick={() => { if (apply({ type: 'buy', plot: buying })) setNotice('새 밭이 생겼어요! 🌱'); setBuying(null) }}>사기</button>
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
      {dressing && (
        <div role="dialog" aria-label="옷 갈아입기" className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-3" onClick={(e) => { if (e.target === e.currentTarget) setDressing(false) }}>
          <div className="sheet-in flex max-h-full w-full max-w-md flex-col rounded-3xl bg-[#fff8fb] p-4 shadow-2xl" style={{ height: 'min(560px, 100%)' }}>
            <GuestDresser avatar={getAvatar()} initial={outfit} invited={false} title="옷 갈아입기" doneLabel="✓ 이 옷 입기"
              onBack={() => setDressing(false)} onUninvite={() => setDressing(false)}
              onDone={(o) => { onOutfit(o); setDressing(false) }} />
          </div>
        </div>
      )}
    </section>
  )
}
