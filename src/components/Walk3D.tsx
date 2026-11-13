import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { SPARKLE_IMG } from './Sparkle'
import { attachMultiplayer } from './remotePlayers3d'
import { WANDS, WEAPON_BY_ID, WEAPON_SCALE, getWeapon, subscribeWeapons } from '../lib/weapons'
import { WeaponShop } from './WeaponShop'
import { MONSTERS, loadDex, nextStageIn, stageOf } from '../lib/monsters'
import { HUD_BUSY } from './MultiplayerBar'
import { getMp, subscribeMp } from '../lib/mp/session'
import { attachBoss, type BossHunt, type BossUi } from './bossHunt3d'
import { EXTRA_ANIMALS, animal3dAspect, animal3dUrl, walkingAway } from '../lib/animals3d'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { avatarName, getAvatar } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import { MY_ROOM_ID, findItem, isFound, travelFindable, travelItem } from '../lib/game'
import { setPartyState } from '../lib/party'
import { assetUrl } from '../lib/items'
import { actFarm } from '../lib/farm'
import { getMeet, talkFor, type Talk } from '../lib/meet'
import { playOrder, playServe, playTap } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { cafeShopSprite, stallSprite } from './viewSprite3d'
import { ANIMAL_H, HOUSE_ART, createWorld, showBack, signCanvas, nameTagCanvas, emojiCanvas, type Doll, type World } from './world3d'

/**
 * 3D 산책: 마을은 3D(길·나무·집·꽃·구름)이고, 아바타와 동물 친구는 지금 그림을 세운 '종이 인형'이다.
 * 땅을 누르면 그곳으로 걷고, 끌면 둘레를 돈다. 길에 반짝이(✨)가 있으면 가서 줍고, 친구를 누르면 다가가서 이야기한다.
 */
const WORLD = 70
/** 마지막으로 산책하던 자리·방향(앱을 켜 둔 동안 기억) */
let lastWalk: { x: number; z: number; yaw: number } | null = null
/** 집 가운데에서 이만큼 안에 들어오면 들어갈지 묻는다(집 크기 반지름 2.5 + 둘레) */
const HOUSE_NEAR = 5
/** 산책 마을 나무: 초록·노랑·주황 꽃나무(카페·농장의 그 나무) */
const WALK_TREES = [
  { img: 'cafe/3d/tree.webp', aspect: 951 / 1024, h: 4.2 },
  { img: 'cafe/3d/tree_yellow.webp', aspect: 824 / 866, h: 4.2 },
  { img: 'cafe/3d/tree_orange.webp', aspect: 827 / 865, h: 4.2 },
] as const
/** 몬스터 마법 풀기: 마법봉으로 이만큼 톡톡 */
const HITS = 10
/** 마법이 풀린 몬스터가 하는 고마운 말 */
const THANKS = ['구해 줘서 고마워! 💕', '덕분이야! 이제 마음이 따뜻해졌어 😊', '고마워! 우리 이제 친구 하자! 🤝', '마법이 풀렸어! 정말 고마워 ✨', '덕분에 다시 웃을 수 있게 됐어! 💖', '고마워~ 너는 정말 멋진 마법사야! 🪄']
/** 지금까지 마법을 풀어 준 몬스터 수 */
const RESCUE_KEY = 'ryuso.walk.rescuedCount'
const loadRescued = () => { try { const n = Number(localStorage.getItem(RESCUE_KEY)); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0 } catch { return 0 } }
/** 한꺼번에 돌아다니는 몬스터 수(풀어 주거나 멀어지면 다른 곳에 새 몬스터가 나온다) */
const MONSTER_SLOTS = 6
const SPARKLES = 10
/** 산책길: 한 바퀴 이어진 고리(끝이 다시 처음과 이어져서 걷다 보면 처음 자리로 돌아온다) */
const loopCurve = () => new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, r = WORLD * 0.62 + Math.sin(i * 2.3) * 7; return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r) }), true)
/** 처음 카메라 방향: 아바타 뒤에서 길 앞쪽을 보게 */
const startYaw = () => { const t = loopCurve().getTangentAt(20 / 240); return Math.atan2(-t.x, -t.z) }

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function Walk3D({ outfit, tweaks, onExit, onGo, onEnter }: { outfit: Outfit; tweaks: Tweaks; onExit: () => void; /** 길가 카페·농장 노점에서 그쪽 화면으로 */ onGo?: (to: 'cafe' | 'farm') => void; /** 집에 들어가면 그 장소(집 안) 화면으로 */ onEnter?: (place: string) => void }) {
  const onEnterRef = useRef(onEnter)
  onEnterRef.current = onEnter
  const [near, setNear] = useState<'cafe' | 'farm' | null>(null)
  const nearRef = useRef<'cafe' | 'farm' | null>(null)
  const onGoRef = useRef(onGo)
  onGoRef.current = onGo
  const host = useRef<HTMLDivElement>(null)
  const world = useRef<World | null>(null)
  const [ready, setReady] = useState(false)
  const [got, setGot] = useState<string | null>(null)
  /** 이야기: step 은 지금 묻는 질문, said 는 친구가 방금 한 답, done 이면 끝 */
  const [talk, setTalk] = useState<{ animal: number; t: Talk; step: 0 | 1; said: string | null; done: boolean } | null>(null)
  const talking = useRef<number | null>(null)
  const [hello, setHello] = useState<string | null>(null)
  /** 가까이 간 집: 들어갈지 묻는다 */
  const [askHouse, setAskHouse] = useState<string | null>(null)
  const answerHouseRef = useRef<(yes: boolean) => void>(() => {})
  useEffect(() => { if (!hello) return; const t = setTimeout(() => setHello(null), 2600); return () => clearTimeout(t) }, [hello])
  // 몬스터 마법 풀기(전투): k = 몬스터 번호, hits = 마법봉으로 친 횟수, done = 마법이 풀림
  const [battle, setBattle] = useState<{ k: number; t: number; hits: number; done: boolean; total?: number; say?: string; unlock?: boolean } | null>(null)
  const battleRef = useRef<number | null>(null)
  battleRef.current = battle && !battle.done ? battle.k : null
  // 같이 사냥(같이 놀기 중일 때 산책에 나오는 대왕 몬스터): 모두가 같은 하나를 보고, 💖 는 같이 채운다
  const mpStatus = useSyncExternalStore(subscribeMp, () => getMp().status)
  const [bossUi, setBossUi] = useState<BossUi | null>(null)
  const [bossDone, setBossDone] = useState<{ type: number; friends: string[]; isNew: boolean } | null>(null)
  const [dex, setDex] = useState(loadDex)
  const [showDex, setShowDex] = useState(false)
  const bossRef = useRef<BossHunt | null>(null)
  const goBossRef = useRef<() => void>(() => {})
  const restBossRef = useRef<() => void>(() => {})
  // 마법 풀기가 시작되면 같이 놀기 말하는 줄을 닫는다(아래 ✨ 단추를 가리지 않게)
  const busy = (!!battle && !battle.done) || !!bossUi?.fight
  useEffect(() => { if (busy) window.dispatchEvent(new Event(HUD_BUSY)) }, [busy])
  // 고른 마법봉·검: 산책·농장·카페가 같이 쓴다(lib/weapons). 처음엔 옷장에서 든 마법봉
  const wand = useSyncExternalStore(subscribeWeapons, () => getWeapon(outfit.wand))
  const [pickWand, setPickWand] = useState(false)
  const zapRef = useRef<() => void>(() => {})
  const fleeRef = useRef<() => void>(() => {})
  const wandRef = useRef(wand)
  wandRef.current = wand
  talking.current = talk?.animal ?? null

  useEffect(() => { if (!got) return; const t = setTimeout(() => setGot(null), 4000); return () => clearTimeout(t) }, [got])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const friendOf = new Map<THREE.Object3D, number>()
    const friends: { animal: number; doll: Doll; x: number; z: number; tx: number; tz: number; wait: number; dir: 1 | -1; t: number }[] = []
    const w = createWorld(el, {
      bounds: WORLD, start: { x: 0, z: 0 }, yaw: lastWalk?.yaw ?? startYaw(), grass: assetUrl('cafe/3d/grass.webp'), onReady: () => setReady(true),
      // 친구를 누르면 그 친구 앞까지 걸어가서 이야기를 시작한다
      onPick: (o) => {
        // 길가 카페·노점을 누르면 문 앞까지 걸어가서 그쪽으로
        const st = stopOf.get(o)
        if (st) { w.walkTo(st.x, st.z, () => goStop(st.to), 0.5); return }
        // 집을 누르면 문 앞까지 걸어가서 들어간다
        const hs = houseOf.get(o)
        if (hs) { declined = null; w.walkTo(hs.hx, hs.hz, undefined, HOUSE_NEAR - 0.6); return }
        // 몬스터: 마법 풀기 중이면 마법봉으로 톡, 아니면 가서 마법 풀기 시작
        const bh = bossRef.current
        if (bh?.owns(o)) { if (bh.fighting()) zapRef.current(); else if (battleRef.current === null) bh.go(); return }
        const mk = monOf.get(o)
        if (mk !== undefined && !(bossRef.current?.fighting() ?? false)) {
          if (battleRef.current === mk) zapRef.current()
          else if (battleRef.current === null) { const m = monsters[mk]; w.walkTo(m.x, m.z, () => startBattle(mk), 2.4) }
          return
        }
        const k = friendOf.get(o)
        if (k === undefined || talking.current !== null) return
        const f = friends[k]
        // 새 친구는 인사만
        if (f.animal < 0) { const e = EXTRA_ANIMALS[-f.animal - 1]; playOrder(); setHello(`${e.name}: ${e.hi}`); return }
        w.walkTo(f.x, f.z, () => {
          playOrder()
          f.wait = 999
          talking.current = f.animal
          setTalk({ animal: f.animal, t: talkFor(f.animal, avatarName(getAvatar()), !getMeet().met.includes(f.animal)), step: 0, said: null, done: false })
        }, 1.8)
      },
    })
    world.current = w
    // 같이 놀기(멀티플레이어): 켜지 않으면 아무것도 하지 않는다
    const detachMp = attachMultiplayer(w, 'walk')
    const { scene, rnd, keep, lambert } = w

    // 산책길: 구불구불한 흙길(카페 흙길 그림) + 길가 돌멩이
    const curve = loopCurve()
    const samples = curve.getSpacedPoints(240)
    w.me.x = samples[20].x; w.me.z = samples[20].z
    // 전에 산책하던 자리에서 이어서(집에 들어갔다 나오거나 다른 탭에 다녀와도 처음으로 돌아가지 않게)
    if (lastWalk) { w.me.x = lastWalk.x; w.me.z = lastWalk.z }
    const roadW = 3.4
    const pos: number[] = [], idx: number[] = [], uv: number[] = []
    let along = 0
    samples.forEach((p, i) => {
      const t = curve.getTangentAt(i / (samples.length - 1))
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(roadW / 2)
      pos.push(p.x + n.x, 0.02, p.z + n.z, p.x - n.x, 0.02, p.z - n.z)
      if (i) along += p.distanceTo(samples[i - 1])
      uv.push(0, along / roadW, 1, along / roadW) // 흙길 그림 한 장 = 길 폭만큼
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    })
    const roadGeo = keep(new THREE.BufferGeometry())
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    roadGeo.setIndex(idx)
    roadGeo.computeVertexNormals()
    const dirt = w.texOf(assetUrl('cafe/3d/dirt.webp'))
    dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping
    const road = new THREE.Mesh(roadGeo, keep(new THREE.MeshLambertMaterial({ map: dirt, side: THREE.DoubleSide })))
    road.receiveShadow = true
    scene.add(road)
    const stoneGeo = keep(new THREE.SphereGeometry(0.18, 8, 6)), stoneMat = lambert(0xe3e0d6)
    samples.forEach((p, i) => {
      if (i % 4) return
      const t = curve.getTangentAt(i / (samples.length - 1))
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize()
      for (const s of [1, -1]) {
        const st = new THREE.Mesh(stoneGeo, stoneMat)
        st.position.copy(p).addScaledVector(n, s * (roadW / 2 + 0.15)).setY(0.06)
        st.scale.set(1, 0.6, 1)
        scene.add(st)
      }
    })
    const nearRoad = (x: number, z: number, d: number) => samples.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < d * d)

    // 집: 길가에 여행 집 그림(물약 가게·보라 궁전·분홍 성·과자 집)
    // 집마다 들어가면 2D 산책과 같은 장소(집 안)로: 분홍 성은 우리집(내 방), 나머지는 테마 장소
    // 집 일곱 채: 처음 서 있는 곳 가까이에 길 양쪽으로 번갈아 모여 있다(마을처럼, 카페 노점 자리는 비우고)
    const HOUSE_PLACE = [
      { place: MY_ROOM_ID, name: '내 방', tag: '🏠', color: '#ffe0ea', art: HOUSE_ART[2] },
      { place: 'halloween', name: '핼러윈', tag: '🎃', color: '#ffe3c2', art: HOUSE_ART[0] },
      { place: 'valentine', name: '밸런타인데이', tag: '💝', color: '#ffd1de', art: { img: 'travel/3d/house_heart.webp', aspect: 778 / 1024 } },
      { place: 'palace', name: '궁전', tag: '👑', color: '#e6d9ff', art: HOUSE_ART[1] },
      { place: 'alice', name: '앨리스', tag: '🫖', color: '#d7ecff', art: { img: 'travel/3d/house_clock.webp', aspect: 924 / 1024 } },
      { place: 'christmas', name: '크리스마스', tag: '🎄', color: '#d8f2d9', art: HOUSE_ART[3] },
      { place: 'winter', name: '겨울왕국', tag: '❄️', color: '#dcf3fb', art: { img: 'travel/3d/house_moon.webp', aspect: 820 / 1024 } },
    ]
    const houses = [0.12, 0.17, 0.22, 0.36, 0.41, 0.46, 0.51].map((u, k) => {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u)
      const nd = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(k % 2 ? 1 : -1)
      const hx = p.x + nd.x * 6.5, hz = p.z + nd.z * 6.5
      const art = HOUSE_PLACE[k].art
      // 길에서 집 문 앞까지 흙길(집 밑까지 이어서 끊기지 않게)
      // 산책길 가장자리에서 시작(덤불이 산책길 위에 놓이지 않게)
      w.addCurvePath([[p.x + nd.x * 1.5, p.z + nd.z * 1.5], [p.x + nd.x * 3.2 + t.x * 0.8, p.z + nd.z * 3.2 + t.z * 0.8], [hx, hz]], 2.2, 'start')
      const d = w.addProp(art.img, hx, hz, 6, art.aspect, 2.5)
      w.pickables.push(d.root)
      // 지붕 위에 떠 있는 이름표(항상 카메라를 보고, 멀리서는 작게 보인다)
      const hp = HOUSE_PLACE[k]
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: w.texOf(nameTagCanvas(hp.tag, hp.name, hp.color)), transparent: true, depthWrite: false }))
      tag.scale.set(4.4, 1.1, 1)
      tag.position.set(hx, 6.9, hz)
      w.scene.add(tag)
      return { ...HOUSE_PLACE[k], doll: d, x: hx - nd.x * 3, z: hz - nd.z * 3, hx, hz }
    })
    const houseOf = new Map(houses.map((h) => [h.doll.root as THREE.Object3D, h]))
    let entering = false
    let asked: (typeof houses)[number] | null = null, declined: (typeof houses)[number] | null = null
    // 집에서 막 나왔으면 그 집 앞이라 바로 다시 묻지 않는다(멀어졌다 오면 다시 묻는다)
    declined = houses.find((h) => Math.hypot(w.me.x - h.hx, w.me.z - h.hz) < HOUSE_NEAR + 1) ?? null
    answerHouseRef.current = (yes) => { const h = asked; if (!h) return; if (yes) { w.walkTo(w.me.x, w.me.z); enterHouse(h) } else declined = h; asked = null; setAskHouse(null) }
    /** 집에 들어간다: 가까이 있는 동물 친구들에게 「우리집에 놀러 가자!」 하고 같이 들어간다 */
    const enterHouse = (h: (typeof houses)[number]) => {
      if (entering || !onEnterRef.current) return
      entering = true
      const pals = friends.filter((f) => f.animal >= 0 && Math.hypot(f.x - w.me.x, f.z - w.me.z) < 16).slice(0, 3)
      if (pals.length) {
        setHello(`🏠 친구들아, ${h.place === MY_ROOM_ID ? '우리집에' : `${h.name}에`} 놀러 가자! · ${pals.map((f) => CALL_ANIMALS[f.animal].name).join('·')}: 「좋아! 🎵」`)
        for (const f of pals) { f.tx = h.x + (Math.random() - 0.5) * 1.5; f.tz = h.z + (Math.random() - 0.5) * 1.5; f.wait = 0 }
      }
      playServe()
      window.setTimeout(() => {
        setPartyState(pals.length ? { place: h.place, guests: pals.map((f) => f.animal) } : { place: null, guests: [] })
        onEnterRef.current?.(h.place)
      }, pals.length ? 1600 : 300)
    }

    // 길가에 카페 가게와 농장 노점: 길에서 갈래 흙길로 이어지고, 가까이 가면 「카페로 / 농장으로」 단추
    const stops = ([[0.3, 'cafe'], [0.72, 'farm']] as const).map(([u, to]) => {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u)
      const out = new THREE.Vector3(p.x, 0, p.z).normalize() // 고리 바깥쪽
      const bx = p.x + out.x * 9, bz = p.z + out.z * 9
      w.addCurvePath([[p.x + out.x * 1.5, p.z + out.z * 1.5], [p.x + out.x * 4 + t.x * 0.6, p.z + out.z * 4 + t.z * 0.6], [bx, bz]], 2.4, 'start') // 건물 밑까지(끊기지 않게), 갈림목에 덤불
      const sp = to === 'cafe' ? cafeShopSprite(w) : stallSprite(w)
      sp.root.position.set(bx, 0, bz)
      sp.root.rotation.y = Math.atan2(-out.x, -out.z) // 앞이 길 쪽
      scene.add(sp.root)
      w.obstacles.push({ x: bx, z: bz, r: to === 'cafe' ? 2.4 : 1.7 })
      const sign = w.paperDoll(w.texOf(signCanvas(to === 'cafe' ? '☕ 카페' : '🧺 농장', '이쪽으로')), 2, 1)
      sign.root.position.set(p.x + out.x * 2.6 + t.x * 2.2, 0, p.z + out.z * 2.6 + t.z * 2.2)
      w.pickables.push(sp.root)
      return { to, sp, sign, x: bx - out.x * 3, z: bz - out.z * 3 }
    })
    const stopOf = new Map(stops.map((st) => [st.sp.root as THREE.Object3D, st]))
    let going = false
    const goStop = (to: 'cafe' | 'farm') => { if (going || !onGoRef.current) return; going = true; playServe(); window.setTimeout(() => onGoRef.current?.(to), 300) }

    // 나무: 절반은 길가에, 나머지는 들판에
    let trees = 0
    for (let i = 0; i < 400 && trees < 110; i++) {
      const s0 = samples[Math.floor(rnd() * samples.length)], a = rnd() * Math.PI * 2, far = 6 + rnd() * 8
      const [x, z] = i % 2 ? [s0.x + Math.cos(a) * far, s0.z + Math.sin(a) * far] : [(rnd() - 0.5) * WORLD * 1.9, (rnd() - 0.5) * WORLD * 1.9]
      if (nearRoad(x, z, 4.5) || w.obstacles.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 9)) continue
      // 산책 마을 나무는 초록·노랑·주황 꽃나무 세 가지만
      w.addTree(x, z, 0.8 + rnd() * 0.5, WALK_TREES[Math.floor(rnd() * WALK_TREES.length)])
      trees++
    }
    // 꽃 덤불: 길가와 들판 여기저기
    let bushes = 0
    for (let i = 0; i < 300 && bushes < 60; i++) {
      const s0 = samples[Math.floor(rnd() * samples.length)], a = rnd() * Math.PI * 2, far = 3.2 + rnd() * 4
      const [x, z] = i % 3 ? [s0.x + Math.cos(a) * far, s0.z + Math.sin(a) * far] : [(rnd() - 0.5) * WORLD * 1.9, (rnd() - 0.5) * WORLD * 1.9]
      if (nearRoad(x, z, 2.8) || w.obstacles.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r + 1.4) ** 2)) continue
      w.addProp('cafe/3d/bush.webp', x, z, 0.9 + rnd() * 0.4, 1024 / 616, 0.45)
      bushes++
    }

    // 꽃: 납작한 꽃송이를 한꺼번에(InstancedMesh)
    const flowers = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 8)), keep(new THREE.MeshLambertMaterial({ color: 0xffffff })), 700)
    const mtx = new THREE.Matrix4(), col = new THREE.Color()
    const flowerColors = [0xff8fb1, 0xffd54a, 0xffffff, 0xc7a6ff, 0xff9e6b]
    for (let i = 0; i < 700; i++) {
      const s = samples[Math.floor(rnd() * samples.length)]
      const a = rnd() * Math.PI * 2, d = roadW / 2 + 0.6 + rnd() * 7
      mtx.makeScale(0.6 + rnd() * 0.6, 1, 0.6 + rnd() * 0.6).setPosition(s.x + Math.cos(a) * d, 0.04, s.z + Math.sin(a) * d)
      flowers.setMatrixAt(i, mtx)
      flowers.setColorAt(i, col.setHex(flowerColors[Math.floor(rnd() * flowerColors.length)]))
    }
    scene.add(flowers)

    // 반짝이: 길 위 열 곳. 아직 못 찾은 여행 아이템이 늘 같은 자리에 숨어 있다(찾으면 사라진다)
    const pool = travelFindable().sort((a, b) => (a.id < b.id ? -1 : 1))
    const sparkTex = w.texOf(assetUrl(SPARKLE_IMG))
    const sparks: { id: string; sprite: THREE.Sprite; x: number; z: number; t: number }[] = []
    for (let k = 0; k < SPARKLES && pool.length; k++) {
      const item = pool[hash(`walk3d${k}`) % pool.length]
      if (isFound(item.id) || sparks.some((s) => s.id === item.id)) continue
      const s = samples[27 + k * 20]
      const sprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false })))
      const x = s.x + ((k % 3) - 1) * 0.9, z = s.z
      sprite.position.set(x, 0.7, z)
      sprite.scale.setScalar(1.4)
      scene.add(sprite)
      sparks.push({ id: item.id, sprite, x, z, t: k })
    }

    // 동물 친구 넷: 근처를 거닐다 쉬었다 한다. 누르면 이야기
    // 새 친구 다섯(호랑이·너구리·유니콘·하마·사자, 누르면 인사)은 animal 이 -1, -2 … (이야기 대신 인사)
    ;[0, 2, 4, 6, -1, -2, -3, -4, -5].forEach((animal, k) => {
      const img = animal >= 0 ? CALL_ANIMALS[animal].img : EXTRA_ANIMALS[-animal - 1].img
      const doll = w.paperDoll(w.texOf(animal3dUrl(img)), ANIMAL_H, animal3dAspect(img))
      doll.root.userData.tex = [w.texOf(animal3dUrl(img)), w.texOf(animal3dUrl(img, true))]
      const s = samples[(42 + k * 22) % samples.length] // 처음 자리도 아바타(20번)에서 멀리
      friendOf.set(doll.root, k)
      w.pickables.push(doll.root)
      const x = s.x + (k % 2 ? 2.2 : -2.2)
      friends.push({ animal, doll, x, z: s.z, tx: x, tz: s.z, wait: rnd() * 2, dir: 1, t: rnd() * 5 })
    })

    // 마법에 걸린 몬스터: 아바타 둘레(길가·숲속 어디든)에 여섯이 돌아다닌다. 풀어 주거나 멀리 떨어지면 다른 곳에 새 몬스터가 나온다
    let rescuedCount = loadRescued()
    const monTexCache = new Map<string, THREE.Texture>()
    const monTex = (id: string, mood: 'angry' | 'happy' | 'back') => { const k = `${id}_${mood}`; if (!monTexCache.has(k)) monTexCache.set(k, w.texOf(assetUrl(`travel/monster/${k}.webp`))); return monTexCache.get(k)! }
    const MH = ANIMAL_H * 1.35
    type Mon = { k: number; type: number; id: string; doll: Doll; x: number; z: number; hx: number; hz: number; tx: number; tz: number; wait: number; dir: 1 | -1; h: number; happy: boolean; freed: boolean; freedAt: number; hits: number; cool: boolean; shake: number; spin: number; t: number }
    const monsters: Mon[] = []
    const freeSpot = (x: number, z: number, self: Mon | null) =>
      Math.abs(x) < WORLD - 4 && Math.abs(z) < WORLD - 4 &&
      !w.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.5) &&
      !monsters.some((o) => o !== self && Math.hypot(o.x - x, o.z - z) < 7)
    /** 그 칸에 새 몬스터를 낸다: 아바타에서 min~max 떨어진 빈 곳(길가든 숲속이든) */
    const spawn = (m: Mon, min = 12, max = 26) => {
      let x = m.x, z = m.z
      // 대부분은 아바타가 바라보는 쪽(앞) 부채꼴에 낸다: 걸어가다 보면 만난다
      const fwd = Math.atan2(w.me.z - w.camera.position.z, w.me.x - w.camera.position.x)
      for (let i = 0; i < 30; i++) {
        const a = rnd() < 0.7 ? fwd + (rnd() - 0.5) * 2.2 : rnd() * Math.PI * 2, d = min + rnd() * (max - min)
        const cx = w.me.x + Math.cos(a) * d, cz = w.me.z + Math.sin(a) * d
        if (freeSpot(cx, cz, m)) { x = cx; z = cz; break }
      }
      const pool = MONSTERS.map((_, i) => i).filter((i) => MONSTERS[i].stage <= stageOf(rescuedCount))
      // 새로 열린 단계의 몬스터가 조금 더 자주 나온다
      const top = pool.filter((i) => MONSTERS[i].stage === stageOf(rescuedCount))
      const type = top.length < pool.length && rnd() < 0.4 ? top[Math.floor(rnd() * top.length)] : pool[Math.floor(rnd() * pool.length)], info = MONSTERS[type]
      const mat = m.doll.doll.material as THREE.MeshBasicMaterial
      mat.map = monTex(info.id, 'angry'); mat.needsUpdate = true
      m.doll.body.scale.set(info.size[0] / info.size[1], 1, 1)
      Object.assign(m, { type, id: info.id, x, z, hx: x, hz: z, tx: x, tz: z, wait: rnd() * 2, happy: false, freed: false, freedAt: 0, hits: 0, cool: false, shake: 0, spin: -1 })
      m.doll.root.position.set(x, 0, z)
    }
    for (let k = 0; k < MONSTER_SLOTS; k++) {
      const doll = w.paperDoll(monTex(MONSTERS[0].id, 'angry'), MH, 1)
      w.pickables.push(doll.root)
      const m: Mon = { k, type: 0, id: MONSTERS[0].id, doll, x: 0, z: 0, hx: 0, hz: 0, tx: 0, tz: 0, wait: 0, dir: 1, h: MH, happy: false, freed: false, freedAt: 0, hits: 0, cool: false, shake: 0, spin: -1, t: rnd() * 5 }
      monsters.push(m)
      spawn(m, 8, 24)
    }
    /** 몬스터 앞모습(무서운·귀여운 얼굴)/뒷모습(걸어서 멀어질 때) */
    const monFace = (m: Mon, back: boolean) => {
      const mat = m.doll.doll.material as THREE.MeshBasicMaterial, want = back ? monTex(m.id, 'back') : monTex(m.id, m.happy ? 'happy' : 'angry')
      if (mat.map !== want) { mat.map = want; mat.needsUpdate = true }
    }
    const monOf = new Map(monsters.map((m) => [m.doll.root as THREE.Object3D, m.k]))
    const startBattle = (k: number) => {
      if (battleRef.current !== null || talking.current !== null || monsters[k].freed) return
      monsters[k].hits = 0
      monFace(monsters[k], false)
      // 아바타 옆(화면에서 오른쪽)으로 와서 선다: 아바타에 가려지지 않게
      { const m = monsters[k], cx = w.me.x - w.camera.position.x, cz = w.me.z - w.camera.position.z, l = Math.hypot(cx, cz) || 1, rx = -cz / l, rz = cx / l
        const nx = w.me.x - rx * 2.4 + (cx / l) * 0.8, nz = w.me.z - rz * 2.4 + (cz / l) * 0.8
        m.x = nx; m.z = nz; m.tx = nx; m.tz = nz; m.doll.root.position.set(nx, 0, nz) }
      battleRef.current = k
      playOrder()
      w.walkTo(w.me.x, w.me.z) // 멈춘다
      setBattle({ k, t: monsters[k].type, hits: 0, done: false })
    }
    // 반짝이 효과(마법봉에서 몬스터로 날아가는 빛, 마법이 풀릴 때 사방으로 퍼지는 별)
    const wpTex = new Map<string, THREE.Texture>()
    const fxTex = [w.texOf(assetUrl(SPARKLE_IMG)), w.texOf(emojiCanvas('⭐')), w.texOf(emojiCanvas('💖'))]
    const fx: { sp: THREE.Sprite; v: THREE.Vector3; life: number; max: number; to?: THREE.Vector3; from?: THREE.Vector3; onHit?: () => void }[] = []
    const spark = (tex: THREE.Texture, at: THREE.Vector3, size: number) => { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))); sp.position.copy(at); sp.scale.setScalar(size); scene.add(sp); return sp }
    // 마법봉: 전투 중에는 아바타 손에 든다
    const wandTex = new Map<string, THREE.Texture>()
    const wandSp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })))
    wandSp.scale.set(0.7, 0.7, 1)
    wandSp.visible = false
    // 몸·옷·머리에 가리지 않게 늘 맨 앞에 그린다
    wandSp.material.depthTest = false
    wandSp.renderOrder = 10
    scene.add(wandSp)
    let swing = 0
    fleeRef.current = () => { const k = battleRef.current; if (k !== null) monsters[k].cool = true }
    zapRef.current = () => {
      swing = 1
      const k = battleRef.current
      if (k === null) return
      const m = monsters[k]
      const from = new THREE.Vector3(w.me.x, 1.4, w.me.z), to = new THREE.Vector3(m.x, m.h * 0.55, m.z)
      const wp = WEAPON_BY_ID[wandRef.current] ?? WANDS[0]
      if (!wpTex.has(wp.fx)) wpTex.set(wp.fx, w.texOf(wp.fx === '✨' ? assetUrl(SPARKLE_IMG) : emojiCanvas(wp.fx)))
      const ft = wpTex.get(wp.fx)!
      fx.push({ sp: spark(ft, from, 0.6 + wp.power * 0.2), v: new THREE.Vector3(), life: 0, max: 0.35, from, to, onHit: () => {
        m.shake = 0.25 + wp.power * 0.1
        for (let i = 0; i < 3 + wp.power * 2; i++) fx.push({ sp: spark(i % 2 ? ft : fxTex[0], to, 0.4), v: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), life: 0, max: 0.6 })
        // 맞힌 수는 여기서 센다(상태 업데이트 함수 안에서 효과를 내면 개발 모드에서 두 번 돈다)
        if (m.freed) return
        m.hits = Math.min(HITS, m.hits + wp.power) // 힘이 센 마법봉·검은 한 번에 💖를 여러 칸 채운다
        if (m.hits >= HITS) {
          // 마법이 풀린다: 빙글 한 바퀴 돌면서 귀여운 얼굴로 + 별이 사방으로
          m.freed = true
          m.spin = 0
          playServe()
          for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; fx.push({ sp: spark(fxTex[i % 3], to.clone(), 0.6), v: new THREE.Vector3(Math.cos(a) * 3.5, 1.5 + Math.random() * 2.5, Math.sin(a) * 3.5), life: 0, max: 1.6 }) }
          m.freedAt = performance.now()
          const before = stageOf(rescuedCount)
          rescuedCount++
          const unlock = stageOf(rescuedCount) > before
          try { localStorage.setItem(RESCUE_KEY, String(rescuedCount)) } catch { /* 이번만 */ }
          actFarm({ type: 'earn', amount: 10 })
          battleRef.current = null
          setBattle({ k: m.k, t: m.type, hits: HITS, done: false })
          // 휘리릭 돌아 웃는 얼굴이 된 다음에 고맙다고 인사한다
          const total = rescuedCount, say = THANKS[Math.floor(Math.random() * THANKS.length)]
          window.setTimeout(() => setBattle({ k: m.k, t: m.type, hits: HITS, done: true, total, say, unlock }), 1000)
        } else {
          playTap()
          setBattle({ k: m.k, t: m.type, hits: m.hits, done: false })
        }
      } })
    }

    // ── 같이 사냥하는 대왕 몬스터(bossHunt3d: 농장·카페와 같은 것) ──
    const bossSpot = () => {
      for (let i = 0; i < 40; i++) {
        const s = samples[Math.floor(Math.random() * samples.length)], a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 4
        const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d
        if (Math.abs(x) < WORLD - 6 && Math.abs(z) < WORLD - 6 && !w.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 2.5)) return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }
      }
      return { x: samples[0].x, z: samples[0].z }
    }
    const boss = attachBoss(w, 'walk', {
      spot: bossSpot,
      canFight: () => battleRef.current === null && talking.current === null,
      onUi: setBossUi,
      onDone: (d) => { setDex(loadDex()); setBossDone(d) },
    })
    bossRef.current = boss
    goBossRef.current = boss.go
    restBossRef.current = boss.rest
    const zapLocal = zapRef.current
    zapRef.current = () => {
      if (!boss.fighting()) { zapLocal(); return }
      swing = 1
      const wp = WEAPON_BY_ID[wandRef.current] ?? WANDS[0]
      if (!wpTex.has(wp.fx)) wpTex.set(wp.fx, w.texOf(wp.fx === '✨' ? assetUrl(SPARKLE_IMG) : emojiCanvas(wp.fx)))
      boss.zap(wp.power, wpTex.get(wp.fx))
    }

    let helpBk: number | null = null, helpers: typeof friends = []
    w.onFrame((dt, now) => {
      for (const st of stops) { st.sp.update(w.camera); w.face(st.sign, 1) }
      const nearStop = stops.find((st) => Math.hypot(w.me.x - st.x, w.me.z - st.z) < 6)?.to ?? null
      // 가게 문 앞까지 걸어가면 바로 그쪽으로 간다
      const atDoor = battleRef.current === null && talking.current === null ? stops.find((st) => Math.hypot(w.me.x - st.x, w.me.z - st.z) < 1.6) : undefined
      if (atDoor) goStop(atDoor.to)
      // 집 앞·뒤·옆 어디든 가까이 가면 「들어갈까요?」 묻는다(아니요 하면 멀어졌다 다시 올 때까지 묻지 않는다)
      const nearHouse = battleRef.current === null && talking.current === null && !entering ? houses.find((h) => Math.hypot(w.me.x - h.hx, w.me.z - h.hz) < HOUSE_NEAR) : undefined
      if (declined && Math.hypot(w.me.x - declined.hx, w.me.z - declined.hz) > HOUSE_NEAR + 2) declined = null
      const ask = nearHouse && nearHouse !== declined ? nearHouse : null
      if (ask !== asked) { asked = ask; setAskHouse(ask ? ask.name : null) }
      if (nearStop !== nearRef.current) { nearRef.current = nearStop; setNear(nearStop) }
      // 몬스터: 가까이 가면 마법 풀기 시작, 맞으면 흔들, 다 풀리면 빙글 돌며 얼굴이 바뀐다
      const bk = battleRef.current
      for (const m of monsters) {
        m.t += dt
        if (m.cool && Math.hypot(w.me.x - m.x, w.me.z - m.z) > 6) m.cool = false // 도망갔다가 멀어지면 다시 만날 수 있다
        const dMe = Math.hypot(w.me.x - m.x, w.me.z - m.z)
        if (!m.freed && !m.cool && bk === null && !(bossRef.current?.fighting() ?? false) && talking.current === null && dMe < 3.2) startBattle(m.k)
        // 너무 멀어진 몬스터, 풀어 주고 한참 지난 몬스터는 아바타 둘레 다른 곳에 새 몬스터로
        if (bk !== m.k && m.spin < 0 && (dMe > 45 || (m.freed && now - m.freedAt > 20000 && dMe > 12))) spawn(m)
        // 돌아다니기: 제 자리 둘레를 천천히(마법 풀기 중인 몬스터는 멈춘다)
        if (bk !== m.k && m.spin < 0) {
          if (m.wait > 0) { m.wait -= dt; monFace(m, false) }
          else {
            const dx = m.tx - m.x, dz = m.tz - m.z, d = Math.hypot(dx, dz)
            if (d < 0.15) {
              m.wait = 1 + rnd() * 3
              for (let i = 0; i < 6; i++) { const tx = m.hx + (rnd() - 0.5) * 10, tz = m.hz + (rnd() - 0.5) * 10; if (freeSpot(tx, tz, m)) { m.tx = tx; m.tz = tz; break } }
            } else {
              const sp = m.happy ? 1.4 : 0.9
              m.x += (dx / d) * sp * dt; m.z += (dz / d) * sp * dt
              monFace(m, walkingAway(dx, dz, m.x, m.z, w.camera.position.x, w.camera.position.z))
              w.pushOut(m, 0.5)
              const side = w.screenSide(dx, dz)
              if (Math.abs(side) > 0.05) m.dir = side > 0 ? 1 : -1
            }
          }
          m.doll.root.position.set(m.x, 0, m.z)
        }
        w.face(m.doll, m.dir)
        let sx = 0
        if (m.shake > 0) { m.shake -= dt; sx = Math.sin(m.shake * 60) * 0.15 }
        m.doll.body.position.set(sx, m.happy ? Math.abs(Math.sin(m.t * 3)) * 0.12 : m.wait > 0 ? Math.abs(Math.sin(m.t * 6)) * 0.04 : Math.abs(Math.sin(m.t * 8)) * 0.08, 0)
        if (m.spin >= 0) {
          // 휘리릭: 0.8초 동안 빠르게 세 바퀴(점점 느려지며), 살짝 뛰어올랐다가 통 내려앉는다
          m.spin += dt / 0.8
          const u = Math.min(1, m.spin), ease = 1 - Math.pow(1 - u, 3)
          if (u >= 0.3 && !m.happy) { m.happy = true; (m.doll.doll.material as THREE.MeshBasicMaterial).map = monTex(m.id, 'happy'); (m.doll.doll.material as THREE.MeshBasicMaterial).needsUpdate = true }
          if (m.spin >= 1) { m.spin = -1; m.doll.root.scale.setScalar(1) }
          else {
            m.doll.body.rotation.y += ease * Math.PI * 6
            m.doll.body.position.y += Math.sin(u * Math.PI) * 0.6
            m.doll.root.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.15)
          }
        }
      }
      // 마법봉은 전투 중에만 아바타 손에
      const armed = bk !== null || (bossRef.current?.fighting() ?? false)
      wandSp.visible = armed
      if (armed) {
        const id = wandRef.current
        const wp = WEAPON_BY_ID[id]
        if (wp) { if (!wandTex.has(id)) wandTex.set(id, w.texOf(assetUrl(wp.img))); if (wandSp.material.map !== wandTex.get(id)) { wandSp.material.map = wandTex.get(id)!; wandSp.material.needsUpdate = true } }
        const r = new THREE.Vector3().subVectors(w.camera.position, new THREE.Vector3(w.me.x, 0, w.me.z)).cross(new THREE.Vector3(0, 1, 0)).normalize()
        if (wp?.sword) {
          // 검: 손잡이(그림 오른쪽 위)를 화면 왼쪽 손에 쥐고 칼날은 바깥 아래로. 마법을 쏠 때 살짝 휘두른다
          wandSp.center.set(0.85, 0.87) // 손잡이 가운데
          wandSp.scale.set(WEAPON_SCALE * 1.25 * wp.aspect, WEAPON_SCALE * 1.25, 1)
          // 그림은 칼끝이 왼쪽 아래: 손잡이를 중심으로 돌려서 칼끝이 위(살짝 바깥쪽)로 서게
          wandSp.material.rotation = -2.2 + Math.sin(now / 260) * 0.06 - swing * 0.9
          // 몸 앞(카메라 쪽)으로 조금 내밀어서 몸 뒤로 숨지 않게
          const fx = w.camera.position.x - w.me.x, fz = w.camera.position.z - w.me.z, fl = Math.hypot(fx, fz) || 1
          wandSp.position.set(w.me.x + r.x * 0.47 + (fx / fl) * 0.45, 0.9, w.me.z + r.z * 0.47 + (fz / fl) * 0.45)
        } else {
          // 마법봉: 예전의 2.5배. 손잡이(그림 왼쪽 아래)를 화면 왼쪽 손에 쥐고 끝은 위로(살짝 바깥쪽). 마법을 쏠 때 검처럼 휘두른다
          wandSp.center.set(0.4, 0.18)
          wandSp.scale.set(WEAPON_SCALE * 1.75, WEAPON_SCALE * 1.75, 1)
          wandSp.material.rotation = 0.3 + Math.sin(now / 260) * 0.06 + swing * 1.1
          const fx = w.camera.position.x - w.me.x, fz = w.camera.position.z - w.me.z, fl = Math.hypot(fx, fz) || 1
          wandSp.position.set(w.me.x + r.x * 0.47 + (fx / fl) * 0.45, 0.9, w.me.z + r.z * 0.47 + (fz / fl) * 0.45)
        }
        swing = Math.max(0, swing - dt * 4)
      }
      // 반짝이 효과
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i]
        f.life += dt
        const u = Math.min(1, f.life / f.max)
        if (f.to && f.from) f.sp.position.lerpVectors(f.from, f.to, u).setY(f.from.y + (f.to.y - f.from.y) * u + Math.sin(u * Math.PI) * 0.8)
        else { f.sp.position.addScaledVector(f.v, dt); f.v.y -= dt * 3; f.sp.material.opacity = 1 - u }
        f.sp.material.rotation += dt * 4
        if (u >= 1) { scene.remove(f.sp); fx.splice(i, 1); f.onHit?.() }
      }
      // 마법 풀기 때 도와주러 오는 친구: 그 몬스터에서 가까운 두 마리만
      if (bk !== helpBk) { helpBk = bk; helpers = bk === null ? [] : [...friends].sort((a, b) => Math.hypot(a.x - monsters[bk].x, a.z - monsters[bk].z) - Math.hypot(b.x - monsters[bk].x, b.z - monsters[bk].z)).slice(0, 2) }
      for (const f of friends) {
        f.t += dt
        const busy = talking.current === f.animal
        const hk = helpers.indexOf(f)
        if (bk !== null && hk >= 0) {
          // 몬스터 양옆으로 달려간다
          const m = monsters[bk], a = hk ? -0.9 : 0.9, cx = w.camera.position.x - m.x, cz = w.camera.position.z - m.z, base = Math.atan2(cz, cx)
          f.tx = m.x + Math.cos(base + Math.PI / 2 + a) * 2.8; f.tz = m.z + Math.sin(base + Math.PI / 2 + a) * 2.8; f.wait = 0
        }
        if (busy) f.dir = w.me.x < f.x ? -1 : 1
        else if (f.wait > 0) f.wait = Math.min(f.wait, 5) - dt
        else {
          const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz)
          if (d < 0.1) {
            f.wait = 1.5 + rnd() * 3
            // 다음 갈 곳: 아바타에게서 9~24, 다른 친구(가는 곳)에게서 8 이상 떨어진 곳(길가·들판)
            for (let i = 0; i < 12; i++) {
              const s = samples[Math.floor(rnd() * samples.length)]
              const c = Math.hypot(s.x - w.me.x, s.z - w.me.z) < 24 ? { x: s.x + (rnd() - 0.5) * 8, z: s.z + (rnd() - 0.5) * 8 } : (() => { const a = rnd() * Math.PI * 2, d = 9 + rnd() * 15; return { x: w.me.x + Math.cos(a) * d, z: w.me.z + Math.sin(a) * d } })()
              const dMe = Math.hypot(c.x - w.me.x, c.z - w.me.z)
              if (dMe < 9 || dMe > 26 || friends.some((o) => o !== f && Math.hypot(o.tx - c.x, o.tz - c.z) < 8)) continue
              f.tx = c.x; f.tz = c.z
              break
            }
          } else {
            f.x += (dx / d) * 2.3 * dt; f.z += (dz / d) * 2.3 * dt
            showBack(f.doll, walkingAway(dx, dz, f.x, f.z, w.camera.position.x, w.camera.position.z))
            const side = w.screenSide(dx, dz)
            if (Math.abs(side) > 0.05) f.dir = side > 0 ? 1 : -1
            w.pushOut(f, 0.35)
          }
        }
        // 아바타에게 너무 붙지 않게(이야기·마법 풀기 중이 아니면 5 떨어져 선다)
        const gap = busy || (hk >= 0 && bk !== null) ? 1.3 : 5
        const ax = f.x - w.me.x, az = f.z - w.me.z, ad = Math.hypot(ax, az)
        if (ad < gap && ad > 1e-3) { f.x = w.me.x + (ax / ad) * gap; f.z = w.me.z + (az / ad) * gap }
        f.doll.root.position.set(f.x, 0, f.z)
        if (f.wait > 0 || busy) showBack(f.doll, false)
        f.doll.body.position.y = f.wait > 0 || busy ? 0 : Math.abs(Math.sin(f.t * 8)) * 0.1
        w.face(f.doll, f.dir)
      }
      // 반짝이: 통통 뜨고, 아바타가 닿으면 줍는다
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.sprite.position.y = 0.9 + Math.sin(now / 300 + s.t) * 0.15
        s.sprite.material.rotation = Math.sin(now / 500 + s.t) * 0.3
        if (Math.hypot(w.me.x - s.x, w.me.z - s.z) < 1.2) {
          scene.remove(s.sprite)
          sparks.splice(i, 1)
          if (findItem(s.id)) { playServe(); setGot(s.id) }
        }
      }
    })
    return () => { lastWalk = { x: w.me.x, z: w.me.z, yaw: w.getYaw() }; detachMp(); w.dispose(); world.current = null }
  }, [])

  // 옷이 바뀌면 아바타 그림을 다시 그려 판에 붙인다
  useEffect(() => {
    let alive = true
    renderFigure(outfit, tweaks).then((cv) => { if (alive) world.current?.setAvatar(cv) }).catch(() => setReady(true))
    return () => { alive = false }
  }, [outfit, tweaks])

  const endTalk = () => {
    // 이야기를 마친 친구는 잠깐 쉬었다가 다시 거닌다
    setTalk(null)
    talking.current = null
  }
  const gotItem = got ? travelItem(got) : undefined
  const a = talk ? CALL_ANIMALS[talk.animal] : null

  return (
    <section aria-label="3D 산책" className="relative h-full overflow-hidden rounded-3xl bg-[#bfe6ff] select-none">
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#3d6b2f] shadow">🌳 3D 산책</span>
        </div>
        <div className="pointer-events-auto flex gap-1.5">
          <button aria-label="대왕 몬스터 도감" onClick={() => { playTap(); setShowDex(true) }} className="h-10 rounded-full bg-white/95 px-3 text-sm font-black text-[#7a3d8f] shadow">📖 {dex.length}/{MONSTERS.length}</button>
          <button aria-label="닫기" onClick={onExit} className="h-10 w-10 rounded-full bg-white/95 text-lg font-bold shadow">✕</button>
        </div>
      </div>
      {/* 몬스터 마법 풀기 */}
      {battle && (() => {
        const m = MONSTERS[battle.t], wi = WEAPON_BY_ID[wand]
        return battle.done ? (
          <div role="dialog" aria-label="마법이 풀렸어요" className="absolute inset-x-2 bottom-3 z-30 mx-auto flex max-w-md items-center gap-3 rounded-3xl bg-white/95 p-3 shadow-xl">
            <img src={assetUrl(`travel/monster/${m.id}_happy.webp`)} alt="" className="h-16 w-16 shrink-0 object-contain" />
            <p className="m-0 flex-1 text-sm leading-snug font-bold text-[#6b4b52]">🎉 마법이 풀렸어요!<br />{m.name}: 「{battle.say ?? '구해 줘서 고마워! 💕'}」 · +10 코인{battle.total ? <><br /><span className="text-xs text-[#7a3d8f]">지금까지 구한 몬스터 {battle.total}마리{nextStageIn(battle.total) ? ` · ${nextStageIn(battle.total)}마리 더 구하면 새 몬스터!` : ''}</span></> : null}{battle.unlock ? <><br /><span className="text-xs font-black text-[#e0567f]">🌟 새로운 몬스터 친구들이 나타나기 시작했어요!</span></> : null}</p>
            <button onClick={() => { playTap(); setBattle(null) }} className="min-h-11 shrink-0 rounded-full bg-[#ff8fab] px-4 text-sm font-bold text-white shadow">좋아요</button>
          </div>
        ) : (
          <>
            <p role="status" className="absolute inset-x-2 top-14 z-20 mx-auto w-fit max-w-full rounded-2xl bg-white/95 px-3 py-2 text-center text-sm font-extrabold text-[#7a3d8f] shadow">
              😈 {m.name}가 마법에 걸렸어요!<br /><span className="text-[#c0587a]">🐾 다 같이 마법을 풀러 가자!</span>
            </p>
            <div className="absolute inset-x-2 bottom-3 z-30 mx-auto flex w-fit max-w-full flex-col items-center gap-2 rounded-3xl bg-white/95 p-3 shadow-xl">
              <div aria-label={`마법 풀기 ${battle.hits}/${HITS}`} className="flex gap-0.5 text-lg leading-none">{Array.from({ length: HITS }, (_, i) => <span key={i} className={i < battle.hits ? '' : 'opacity-25 grayscale'}>💖</span>)}</div>
              <div className="flex items-center gap-2">
                <button aria-label="마법봉 고르기" onClick={() => { playTap(); setPickWand(true) }} className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#e5cfa3] bg-[#fdf2d8]">
                  {wi ? <img src={assetUrl(wi.img)} alt="" className="h-11 w-11 object-contain" /> : '🪄'}
                </button>
                <button onClick={() => zapRef.current()} className="h-14 rounded-full bg-gradient-to-r from-[#c58bff] to-[#ff8fab] px-6 text-lg font-black text-white shadow-lg active:scale-95">✨ 마법!</button>
                <button onClick={() => { playTap(); fleeRef.current(); setBattle(null) }} className="h-10 rounded-full bg-[#ffe4ec] px-3 text-sm font-bold">도망가기</button>
              </div>
            </div>
          </>
        )
      })()}
      {/* 같이 사냥: 대왕 몬스터 */}
      {mpStatus === 'on' && bossUi && !battle && !talk && (() => {
        const m = MONSTERS[bossUi.type], pct = Math.round((1 - bossUi.hp / bossUi.max) * 100), wi = WEAPON_BY_ID[wand]
        return bossUi.fight ? (
          <>
            {/* 가로 화면에서는 가운데를 가리지 않게 「대왕 몬스터 출현!」 단추가 있던 오른쪽 위로 옮긴다 */}
            <div role="status" className="absolute inset-x-2 top-14 z-20 mx-auto w-72 max-w-full rounded-2xl bg-white/95 px-3 py-2 text-center shadow landscape:inset-x-auto landscape:right-2 landscape:mx-0 landscape:w-52 landscape:px-2 landscape:py-1.5">
              <p className="m-0 text-sm font-extrabold text-[#7a3d8f] landscape:text-xs">👑 대왕 {m.name} · 다 같이 마법 풀기!</p>
              <div aria-label={`마법 풀기 ${pct}%`} className="mt-1 h-3 overflow-hidden rounded-full bg-[#f3dbe6]"><div className="h-full rounded-full bg-gradient-to-r from-[#c58bff] to-[#ff8fab] transition-all" style={{ width: `${pct}%` }} /></div>
              <p className="m-0 mt-1 text-xs font-bold text-[#c0587a]">{bossUi.friends.length ? `🤝 ${bossUi.friends.join(', ')}와(과) 같이 싸우는 중` : '🐾 친구를 불러서 같이 풀어요!'}</p>
            </div>
            <div className="absolute inset-x-2 bottom-3 z-30 mx-auto flex w-fit max-w-full items-center gap-2 rounded-3xl bg-white/95 p-3 shadow-xl">
              <button aria-label="마법봉 고르기" onClick={() => { playTap(); setPickWand(true) }} className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#e5cfa3] bg-[#fdf2d8]">
                {wi ? <img src={assetUrl(wi.img)} alt="" className="h-11 w-11 object-contain" /> : '🪄'}
              </button>
              <button onClick={() => zapRef.current()} className="h-14 rounded-full bg-gradient-to-r from-[#c58bff] to-[#ff8fab] px-6 text-lg font-black text-white shadow-lg active:scale-95">✨ 마법!</button>
              <button onClick={() => { playTap(); restBossRef.current(); setBossUi((u) => (u ? { ...u, fight: false } : u)) }} className="h-10 rounded-full bg-[#ffe4ec] px-3 text-sm font-bold">잠깐 쉬기</button>
            </div>
          </>
        ) : (
          <button onClick={() => { playTap(); goBossRef.current() }} className="absolute top-14 right-2 z-20 flex w-52 items-center whitespace-nowrap gap-1.5 rounded-2xl bg-white/95 px-2 py-1.5 text-left text-xs font-extrabold text-[#7a3d8f] shadow">
            <img src={assetUrl(`travel/monster/${m.id}_angry.webp`)} alt="" className="h-9 w-9 shrink-0 object-contain" />
            <span>👑 대왕 몬스터 출현!{pct ? ` ${pct}%` : ''}<br /><span className="text-[#c0587a]">눌러서 가기 · {bossUi.far}걸음</span></span>
          </button>
        )
      })()}
      {bossDone && (() => {
        const m = MONSTERS[bossDone.type]
        return (
          <div role="dialog" aria-label="다 같이 마법을 풀었어요" className="absolute inset-x-2 bottom-3 z-30 mx-auto flex max-w-md items-center gap-3 rounded-3xl bg-white/95 p-3 shadow-xl">
            <img src={assetUrl(`travel/monster/${m.id}_happy.webp`)} alt="" className="h-16 w-16 shrink-0 object-contain" />
            <p className="m-0 flex-1 text-sm leading-snug font-bold text-[#6b4b52]">🎉 다 같이 대왕 {m.name}의 마법을 풀었어요!<br />{bossDone.friends.length ? `🤝 ${bossDone.friends.join(', ')} 고마워! · ` : ''}+30 코인<br /><span className="text-xs font-black text-[#7a3d8f]">{bossDone.isNew ? '📖 도감에 새로 들어왔어요!' : '📖 도감에 이미 있는 친구예요'} ({dex.length}/{MONSTERS.length})</span></p>
            <button onClick={() => { playTap(); setBossDone(null) }} className="min-h-11 shrink-0 rounded-full bg-[#ff8fab] px-4 text-sm font-bold text-white shadow">좋아요</button>
          </div>
        )
      })()}
      {showDex && (
        <div role="dialog" aria-label="대왕 몬스터 도감" className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 p-3 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) setShowDex(false) }}>
          <div className="flex max-h-full w-full max-w-md flex-col rounded-3xl bg-[#fff8fb] p-4 shadow-2xl">
            <p className="mt-0 mb-1 text-center text-base font-black text-[#7a3d8f]">📖 대왕 몬스터 도감 {dex.length}/{MONSTERS.length}</p>
            <p className="mt-0 mb-2 text-center text-xs font-bold text-black/50">👥 같이 놀기에서 친구들과 대왕 몬스터의 마법을 풀면 모여요</p>
            <div className="grid min-h-0 grid-cols-5 gap-1.5 overflow-y-auto">
              {MONSTERS.map((m) => {
                const have = dex.includes(m.id)
                return (
                  <div key={m.id} aria-label={have ? m.name : '아직 못 만난 몬스터'} className={`flex flex-col items-center rounded-2xl p-1 ${have ? 'bg-white' : 'bg-[#efe6ee]'}`}>
                    <img src={assetUrl(`travel/monster/${m.id}_happy.webp`)} alt="" className={`aspect-square w-full object-contain ${have ? '' : 'opacity-40 brightness-0'}`} />
                    <span className="text-center text-[10px] leading-tight font-extrabold text-[#7a3d8f]">{have ? m.name : '?'}</span>
                  </div>
                )
              })}
            </div>
            <button onClick={() => { playTap(); setShowDex(false) }} className="mt-3 min-h-11 rounded-full bg-[#ff8fab] text-sm font-black text-white">닫기</button>
          </div>
        </div>
      )}
      {pickWand && <WeaponShop onClose={() => setPickWand(false)} />}
      {near && !battle && !talk && onGo && (
        <button onClick={() => { playTap(); onGo(near) }} className="absolute inset-x-2 top-14 z-20 mx-auto h-12 w-fit rounded-full bg-[#ff8fab] px-5 text-base font-black text-white shadow-lg">{near === 'cafe' ? '☕ 카페로 가기' : '🧺 농장으로 가기'}</button>
      )}
      {askHouse && !battle && !talk && (
        <div role="dialog" aria-label="집에 들어가기" className="absolute inset-x-2 bottom-16 z-30 mx-auto flex w-fit max-w-full items-center gap-2 rounded-3xl bg-white/95 p-3 shadow-xl">
          <p className="m-0 text-sm font-extrabold text-[#6b4b52]">🏠 {askHouse}에 들어갈까요?</p>
          <button onClick={() => { playTap(); answerHouseRef.current(true) }} className="h-10 rounded-full bg-[#ff8fab] px-4 text-sm font-black text-white shadow">들어가기</button>
          <button onClick={() => { playTap(); answerHouseRef.current(false) }} className="h-10 rounded-full bg-[#f3e6ea] px-3 text-sm font-bold">아니요</button>
        </div>
      )}
      {hello && !battle && <p role="status" className="absolute inset-x-2 top-14 z-20 mx-auto w-fit max-w-full rounded-2xl bg-white/95 px-3 py-2 text-center text-sm font-extrabold text-[#6b4b52] shadow">{hello}</p>}
      {!talk && !battle && !bossUi?.fight && !bossDone && <p className="pointer-events-none absolute inset-x-2 bottom-3 z-10 m-0 text-center text-xs font-bold text-[#3d6b2f] drop-shadow-[0_1px_0_white]">땅을 누르면 걸어가요 · 옆으로 끌면 둘러봐요 · ✨ 줍고, 친구를 누르면 이야기해요</p>}
      {!ready && <p className="absolute inset-0 z-20 m-0 flex items-center justify-center text-sm font-bold text-[#3d6b2f]">마을을 만드는 중…</p>}

      {gotItem && (
        <div role="status" className="absolute top-14 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-lg">
          <img src={assetUrl(gotItem.thumb)} alt="" className="h-12 w-12 object-contain" />
          <span className="text-sm font-bold whitespace-nowrap">찾았어요! {gotItem.name.ko}</span>
        </div>
      )}

      {talk && a && (
        <div role="dialog" aria-label={`${a.name}랑 이야기`} className="absolute inset-x-2 bottom-3 z-30 mx-auto flex max-w-md flex-col gap-2 rounded-3xl bg-white/95 p-3 shadow-xl">
          <div className="flex items-start gap-2">
            <img src={assetUrl(`cafe/face/${a.img}.webp`)} alt="" draggable={false} className="h-14 w-14 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="m-0 text-xs font-bold text-[#c06a7d]">{a.name}</p>
              <p className="m-0 text-base leading-snug font-bold text-[#6b4b52]">{talk.done ? talk.said : `${talk.said ?? talk.t.hello} ${talk.t.asks[talk.step].ask}`}</p>
            </div>
          </div>
          {!talk.done ? (
            <div className="flex flex-wrap justify-end gap-2">
              {talk.t.asks[talk.step].replies.map((rp) => <button key={rp.label} onClick={() => { playTap(); setTalk(talk.step === 0 ? { ...talk, step: 1, said: rp.answer } : { ...talk, said: rp.answer, done: true }) }}
                className="min-h-11 rounded-full bg-[#ffe1ea] px-4 text-sm font-bold text-[#8a4b55] shadow-sm">{rp.label}</button>)}
            </div>
          ) : (
            <button onClick={() => { playServe(); endTalk() }} className="min-h-11 self-end rounded-full bg-[#ff8fab] px-5 text-sm font-bold text-white shadow">👋 안녕~ 또 만나!</button>
          )}
        </div>
      )}

    </section>
  )
}
