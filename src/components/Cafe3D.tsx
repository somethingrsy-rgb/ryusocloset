import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { renderFigure } from '../lib/exportPng'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { stepCafe } from '../lib/cafeWalk'
import { ANIMAL_H, createWorld, meadowTree, signCanvas, type Doll, type World } from './world3d'

/** 기존 주문 저장을 공유하는 자유 산책 카페. 3D 농장과 같은 바탕(world3d): 같은 카메라 각도·따라가기·걷기·끌어서 둘러보기 */
/** 걸을 수 있는 땅(가운데에서 ±WALK) */
const WALK = 30
/** 농장 가는 길: 가게 뒤(-z)로 곧게 뻗고, 끝(z < -FARM_GATE)까지 가면 농장으로 넘어간다 */
const FARM_GATE = 29
/** 파라솔 테이블 자리: 숲길을 걷다가 하나씩 만나도록 잔디밭 여기저기에 띄엄띄엄(가게는 (0, -6.2)) */
const TABLES: [number, number][] = [[-6.5, 0.5], [6.5, -0.5], [-3, 9], [11, 9], [-15, -7], [16, -8], [3, 17], [-13, 15]]
/** 손님은 테이블 옆(가게 쪽 바깥)에 선다 */
const SIDE = (i: number) => (TABLES[i][0] < 0 ? -1.25 : 1.25)
const tableAt = (i: number) => new THREE.Vector3(TABLES[i][0], 0, TABLES[i][1])
const seatAt = (i: number) => tableAt(i).add(new THREE.Vector3(SIDE(i), 0, 0))

/**
 * 파라솔 테이블 세트(입체): 하얀 동그란 테이블 + 꼬불 다리, 분홍·크림 줄무늬 파라솔(가장자리 물결 + 딸기·꽃 장식),
 * 테이블 위 꽃병, 양옆 하트 등받이 의자. 모양은 한 번 만들고 테이블마다 같이 쓴다.
 */
function makeTableKit(s: Pick<World, 'keep' | 'texOf'>) {
  const { keep } = s
  // 그림처럼 밝은 파스텔이 되게, 그늘진 쪽도 너무 어두워지지 않게 스스로 조금 빛나게 한다
  const lambert = (color: number) => keep(new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.32 }))
  const cream = lambert(0xfff3e6), white = lambert(0xfffaf4), pink = lambert(0xf6a3b6)
  const red = lambert(0xe8505b), leaf = lambert(0x8fcf5a), yellow = lambert(0xffd23f)
  // 줄무늬: 둘레를 16칸으로 나눠 분홍·크림을 번갈아 칠한 그림
  const c = document.createElement('canvas'); c.width = 256; c.height = 8
  const g2 = c.getContext('2d')!
  for (let k = 0; k < 16; k++) { g2.fillStyle = k % 2 ? '#fff1dc' : '#f6a3b6'; g2.fillRect(k * 16, 0, 16, 8) }
  const stripes = keep(new THREE.MeshLambertMaterial({ map: s.texOf(c), side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: s.texOf(c) }))
  const geo = {
    top: keep(new THREE.CylinderGeometry(0.62, 0.6, 0.08, 32)),
    rim: keep(new THREE.TorusGeometry(0.61, 0.03, 8, 32)),
    stem: keep(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 12)),
    curl: keep(new THREE.TorusGeometry(0.13, 0.035, 8, 16, Math.PI * 1.5)),
    foot: keep(new THREE.SphereGeometry(0.06, 10, 8)),
    pole: keep(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 10)),
    canopy: keep(new THREE.ConeGeometry(0.82, 0.36, 16, 1, true)),
    scallop: keep(new THREE.SphereGeometry(0.085, 12, 8)),
    knob: keep(new THREE.SphereGeometry(0.08, 12, 10)),
    berry: keep(new THREE.SphereGeometry(0.075, 10, 8)),
    flower: keep(new THREE.SphereGeometry(0.045, 8, 6)),
    vase: keep(new THREE.CylinderGeometry(0.07, 0.1, 0.16, 14)),
    seat: keep(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 20)),
    leg: keep(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 8)),
    back: keep(new THREE.TorusGeometry(0.2, 0.03, 8, 20, Math.PI)),
    heart: keep(new THREE.TorusGeometry(0.07, 0.022, 8, 14, Math.PI * 1.6)),
  }
  const mesh = (gm: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(gm, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o }
  const chair = (side: number) => {
    const ch = new THREE.Group()
    ch.add(mesh(geo.seat, cream, 0, 0.44, 0))
    for (const [lx, lz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) ch.add(mesh(geo.leg, cream, lx, 0.21, lz))
    // 등받이: 뒤쪽에 세운 반달 + 그 안에 하트 꼬불
    const back = mesh(geo.back, cream, 0, 0.5, -0.2)
    back.scale.set(1, 1.6, 1)
    ch.add(back)
    for (const sx of [-1, 1]) { const h = mesh(geo.heart, cream, sx * 0.06, 0.68, -0.2); h.rotation.z = sx > 0 ? -0.6 : Math.PI + 0.6; ch.add(h) }
    ch.position.set(side * 0.82, 0, 0.05)
    return ch
  }
  return (i: number) => {
    const t = new THREE.Group()
    // 테이블
    t.add(mesh(geo.top, white, 0, 0.74, 0))
    const rim = mesh(geo.rim, cream, 0, 0.72, 0); rim.rotation.x = Math.PI / 2; t.add(rim)
    t.add(mesh(geo.stem, cream, 0, 0.36, 0))
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5
      const cu = mesh(geo.curl, cream, Math.cos(a) * 0.14, 0.13, Math.sin(a) * 0.14)
      cu.rotation.y = -a
      t.add(cu)
      t.add(mesh(geo.foot, cream, Math.cos(a) * 0.27, 0.05, Math.sin(a) * 0.27))
    }
    // 꽃병과 꽃
    t.add(mesh(geo.vase, white, 0.22, 0.86, 0.12))
    for (let k = 0; k < 4; k++) t.add(mesh(geo.flower, k % 2 ? white : yellow, 0.22 + Math.cos(k * 1.6) * 0.06, 0.98 + (k % 2) * 0.03, 0.12 + Math.sin(k * 1.6) * 0.06))
    // 파라솔: 기둥, 줄무늬 지붕, 물결 가장자리, 딸기·꽃 장식, 꼭대기 공
    t.add(mesh(geo.pole, cream, 0, 1.5, 0))
    const canopy = mesh(geo.canopy, stripes, 0, 2.22, 0)
    canopy.rotation.y = (i * 0.37) % (Math.PI / 8)
    t.add(canopy)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + canopy.rotation.y + Math.PI / 16
      const sc = mesh(geo.scallop, k % 2 ? pink : cream, Math.cos(a) * 0.78, 2.03, -Math.sin(a) * 0.78)
      sc.scale.set(1.2, 0.7, 1.2)
      t.add(sc)
      if (k % 4 === 1) t.add(mesh(geo.berry, red, Math.cos(a) * 0.66, 2.13, -Math.sin(a) * 0.66))
      if (k % 4 === 3) { t.add(mesh(geo.flower, white, Math.cos(a) * 0.66, 2.14, -Math.sin(a) * 0.66)); t.add(mesh(geo.flower, leaf, Math.cos(a + 0.14) * 0.64, 2.13, -Math.sin(a + 0.14) * 0.64)) }
    }
    t.add(mesh(geo.knob, cream, 0, 2.42, 0))
    // 의자 두 개(손님이 서는 쪽과 반대쪽)
    t.add(chair(-1), chair(1))
    return t
  }
}

export function Cafe3D({ outfit, tweaks, walking, hold, paused, encounters, onMeet, bubble, float, eating, arrive = false, onFarm }: {
  /** 농장에서 걸어왔으면 농장 가는 길 끝에서 시작 */
  arrive?: boolean
  /** 농장 가는 길 끝에 닿으면 */
  onFarm?: () => void
  outfit: Outfit; tweaks: Tweaks
  walking: boolean; hold: string | null; paused: boolean
  /** 서빙받은 손님의 음식(자리 → 메뉴). 그동안 손님은 자리에 앉아 있고 음식은 테이블 위에 놓인다 */
  eating: Record<number, string>
  encounters: string[]; onMeet: (i: number) => void
  /** 손님 머리 위에 띄울 단추(원래 카페의 말풍선) */
  bubble: (i: number, approach: () => void) => ReactNode
  /** 서빙하고 받은 코인(+3 같은) 표시 */
  float: (i: number) => ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const anchors = useRef<(HTMLDivElement | null)[]>([])
  const floats = useRef<(HTMLDivElement | null)[]>([])
  const world = useRef<World | null>(null)
  const state = useRef({ walking, hold, paused, encounters, onMeet, eating })
  state.current = { walking, hold, paused, encounters, onMeet, eating }
  const approachRef = useRef<(i: number) => void>(() => {})
  const onFarmRef = useRef(onFarm)
  onFarmRef.current = onFarm
  /** 길을 넘어갈 때 하얗게 덮었다 걷는 막 */
  const [fade, setFade] = useState(arrive)
  useEffect(() => { if (!arrive) return; const t = setTimeout(() => setFade(false), 350); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = host.current
    if (!el) return
    const guests: THREE.Object3D[] = [], guestDolls: Doll[] = []
    let following: number | null = null
    const approach = (i: number) => { if (!state.current.paused && i >= 0) following = i }
    approachRef.current = approach
    // 3D 농장과 같은 바탕: 카메라가 아바타 뒤에서 따라가고, 땅을 누르면 걷고, 옆으로 끌면 둘러본다
    const w = createWorld(el, {
      bounds: WALK, start: arrive ? { x: 0, z: -FARM_GATE + 3 } : { x: 0, z: -2.6 }, yaw: arrive ? Math.PI : 0, seed: 7, sky: 0xcdeeff, grass: assetUrl('cafe/3d/grass.webp'),
      onPick: (o) => approach(guests.indexOf(o)),
    })
    world.current = w
    const { scene, keep, rnd } = w
    // 땅을 누르거나 끌면 따라가던 손님은 그만 따라간다(손님을 누른 것이면 onPick 이 다시 정한다)
    const stopFollow = () => { following = null }
    el.addEventListener('pointerdown', stopFollow)
    // 딸기 가게(카운터)·꽃 덤불: 그림을 세운 판(나무처럼 늘 카메라를 본다)
    const props: Doll[] = []
    const prop = (name: string, h: number, aspect: number, x: number, z: number) => {
      const d = w.paperDoll(w.texOf(assetUrl(`cafe/3d/${name}.webp`)), h, aspect)
      d.root.position.set(x, 0, z)
      props.push(d)
      return d
    }
    prop('counter', 5.6, 997 / 1024, 0, -6.2)
    w.obstacles.push({ x: 0, z: -6.2, r: 2.4 })
    // 파라솔 테이블(입체): 잔디밭 여기저기 띄엄띄엄
    const tableKit = makeTableKit(w)
    for (let i = 0; i < 8; i++) {
      const p = tableAt(i), g = tableKit(i)
      g.position.set(p.x, 0, p.z - 0.2)
      scene.add(g)
      w.obstacles.push({ x: p.x, z: p.z - 0.2, r: 0.7 })
    }
    const nearTable = (x: number, z: number, r: number) => TABLES.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < r * r)
    for (const [x, z] of [[-4.2, -5.6], [4.2, -5.6], [-6, -4], [6, -4]]) prop('bush', 1.15, 1024 / 616, x, z)
    // 나무: 농장처럼 듬성듬성(가게·테이블 둘레는 비운다)
    const trees: { x: number; z: number }[] = []
    for (let k = 0; k < 400 && trees.length < 70; k++) {
      const x = (rnd() - 0.5) * 2 * (WALK + 12), z = (rnd() - 0.5) * 2 * (WALK + 12)
      if (Math.abs(x) < 5 && z > -10 && z < 0) continue
      if (Math.abs(x) < 4.5 && z < -8) continue // 농장 가는 길
      if (nearTable(x, z, 4.5) || trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 30)) continue
      trees.push({ x, z })
      w.addTree(x, z, 0.8 + rnd() * 0.6, meadowTree(rnd()))
    }
    for (let k = 0; k < 24; k++) {
      const x = (rnd() - 0.5) * 2 * WALK, z = (rnd() - 0.5) * 2 * WALK
      if ((Math.abs(x) < 5 && z > -10 && z < 0) || (Math.abs(x) < 4 && z < -8) || nearTable(x, z, 3) || trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 4)) continue
      prop('bush', 1.15, 1024 / 616, x, z)
    }
    // 손님: 자리마다 동물 친구(누르면 그쪽으로 걸어간다)
    for (let i = 0; i < 8; i++) {
      const d = w.paperDoll(w.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[i].img}_stand.webp`)), ANIMAL_H, 1)
      const p = seatAt(i)
      d.root.position.set(p.x, 0, p.z)
      guests.push(d.root)
      guestDolls.push(d)
    }
    w.pickables.push(...guests)
    // 손님이 받은 음식: 그 손님 테이블 위에(테이블에 맞는 작은 크기)
    const foods = guestDolls.map(() => { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ transparent: true }))); sp.scale.setScalar(0.5); sp.visible = false; scene.add(sp); return sp })
    // 아바타가 들고 있는 메뉴
    const holdSprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ transparent: true })))
    holdSprite.scale.setScalar(0.75)
    holdSprite.visible = false
    scene.add(holdSprite)
    const holdTex = new Map<string, THREE.Texture>()
    const texFor = (id: string) => { if (!holdTex.has(id)) holdTex.set(id, w.texOf(assetUrl(`cafe/menu2/${id}.webp`))); return holdTex.get(id)! }

    const bounds = { x0: -WALK, x1: WALK, z0: -WALK, z1: WALK }
    const roam = guestDolls.map((d, i) => ({ goal: { x: d.root.position.x, z: d.root.position.z }, wait: i * 0.45, met: '', dir: 1 as 1 | -1 }))
    let t = 0
    const v = new THREE.Vector3()
    const project = (x: number, y: number, z: number) => {
      v.set(x, y, z).project(w.camera)
      return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight, front: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 }
    }
    // 농장 가는 길: 가게 뒤로 곧게, 가게 옆에 표지판
    w.addPath(0, -8.4, 0, -FARM_GATE - 6, 3)
    const sign = w.paperDoll(w.texOf(signCanvas('🌱 농장', '가게 뒤로 쭉')), 2.2, 1)
    sign.root.position.set(3.4, 0, -5.2)
    w.obstacles.push({ x: 3.4, z: -5.2, r: 0.4 })
    let leaving = false
    w.onFrame((dt) => {
      w.face(sign, 1)
      if (!leaving && onFarmRef.current && w.me.z < -FARM_GATE) { leaving = true; setFade(true); window.setTimeout(() => onFarmRef.current?.(), 450) }
      t += dt
      const st = state.current
      const frozen = st.paused || st.walking
      const me = w.me
      // 손님: 주문한 손님(만드는 중·완성·먹는 중)은 자리에서 기다리고, 주문 전 손님은 절반만 자기 테이블 둘레를 거닌다
      for (let i = 0; i < guestDolls.length; i++) {
        const d = guestDolls[i], r = roam[i], p = d.root.position
        const near = Math.hypot(p.x - me.x, p.z - me.z) < 1.5
        // 음식이 완성된 손님(과 먹는 손님)만 자리에 앉아 기다리고, 나머지는 주문했어도 테이블 둘레를 거닌다
        const sits = st.encounters[i].startsWith('ready:') || !!st.eating[i]
        const seat = seatAt(i)
        if (sits) { r.goal = { x: seat.x, z: seat.z }; r.wait = 0 }
        let stepped = false
        if (!frozen && !near && following !== i) {
          r.wait -= dt
          if (!sits && r.wait <= 0 && Math.hypot(p.x - r.goal.x, p.z - r.goal.z) < 0.15) {
            r.goal = { x: seat.x + (Math.random() - 0.5) * 6, z: seat.z + (Math.random() - 0.5) * 6 }
            r.wait = 1.5 + Math.random() * 2.5
          }
          if (r.wait <= 0 && Math.hypot(p.x - r.goal.x, p.z - r.goal.z) > 0.05) {
            const px = p.x, pz = p.z
            const next = stepCafe(p, r.goal, 0.65 * dt, w.obstacles, bounds)
            p.set(next.x, 0, next.z)
            const sd = w.screenSide(next.x - px, next.z - pz)
            if (Math.abs(sd) > 0.0005) r.dir = sd > 0 ? 1 : -1
            stepped = true
            if (!sits && Math.hypot(next.x - r.goal.x, next.z - r.goal.z) < 0.15) r.wait = 1.5 + Math.random() * 2.5
          }
        }
        // 부딪히지 않게: 걷는 손님이 다른 손님·아바타에게서 비킨다
        if (!sits) for (const o of [...guestDolls.filter((_, j) => j !== i).map((x) => x.root.position), { x: me.x, z: me.z }]) {
          const dx = p.x - o.x, dz = p.z - o.z, dd = Math.hypot(dx, dz)
          if (dd < 1 && dd > 1e-3) { p.x = o.x + (dx / dd) * 1; p.z = o.z + (dz / dd) * 1 }
        }
        d.body.position.y = stepped ? Math.abs(Math.sin(t * 7 + i)) * 0.06 : 0
        w.face(d, r.dir)
        if (!near && Math.hypot(p.x - me.x, p.z - me.z) > 2.1) r.met = ''
      }
      // 손님을 눌렀으면 그 손님 앞까지 따라간다
      if (following !== null && !frozen) { const g = guestDolls[following].root.position; w.walkTo(g.x, g.z, () => { following = null }, 1.2) }
      if (!frozen) {
        // 한 번 만난 손님은 멀어졌다 다시 만나거나 주문 상태가 바뀌어야 다시 접객한다
        const i = guestDolls.findIndex((d, i) => st.encounters[i] && Math.hypot(d.root.position.x - me.x, d.root.position.z - me.z) < 1.5 && roam[i].met !== st.encounters[i] && !(roam[i].met.startsWith('ready:') && st.encounters[i].startsWith('new:')))
        if (i >= 0) {
          roam[i].met = st.encounters[i]
          following = null
          w.walkTo(me.x, me.z, () => {}) // 멈춘다
          st.onMeet(i)
        }
      }
      for (const d of props) w.face(d, 1)
      if (st.hold) {
        const tex = texFor(st.hold)
        if (holdSprite.material.map !== tex) { holdSprite.material.map = tex; holdSprite.material.needsUpdate = true }
        holdSprite.position.set(me.x, 1.35, me.z).addScaledVector(v.set(w.camera.position.x - me.x, 0, w.camera.position.z - me.z).normalize(), 0.35)
        holdSprite.visible = true
      } else holdSprite.visible = false
      // 받은 음식: 테이블 위, 손님 쪽으로 조금, 카메라 쪽으로 조금(파라솔에 가리지 않게)
      foods.forEach((sp, i) => {
        const id = st.eating[i]
        sp.visible = !!id
        if (!id) return
        const tex = texFor(id)
        if (sp.material.map !== tex) { sp.material.map = tex; sp.material.needsUpdate = true }
        const tp = tableAt(i)
        // 파라솔 기둥(테이블 가운데)과 겹치지 않게 화면에서 손님 쪽 옆으로 비켜 놓는다
        v.set(w.camera.position.x - tp.x, 0, w.camera.position.z - tp.z).normalize()
        const side = w.screenSide(SIDE(i), 0) >= 0 ? 1 : -1
        sp.position.set(tp.x + v.z * 0.36 * side + v.x * 0.12, 1.0, tp.z - 0.2 - v.x * 0.36 * side + v.z * 0.12)
      })
      // 말풍선·코인 표시를 손님 머리 위 화면 자리에(음식이 나온 동안은 말풍선을 숨긴다)
      for (let i = 0; i < 8; i++) {
        const g = guestDolls[i].root.position
        const pos = project(g.x, ANIMAL_H + 0.1, g.z)
        const a = anchors.current[i], f = floats.current[i]
        if (a) { a.style.transform = `translate(${pos.x}px, ${pos.y}px)`; a.style.visibility = pos.front && !st.eating[i] ? 'visible' : 'hidden' }
        if (f) { f.style.transform = `translate(${pos.x}px, ${pos.y}px)`; f.style.visibility = pos.front ? 'visible' : 'hidden' }
      }
    })
    return () => { el.removeEventListener('pointerdown', stopFollow); world.current = null; w.dispose() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- 처음 한 번만 만든다(arrive 는 처음 자리만 정한다)

  useEffect(() => {
    let alive = true
    renderFigure(outfit, tweaks).then((cv) => { if (alive) world.current?.setAvatar(cv) }).catch(() => {})
    return () => { alive = false }
  }, [outfit, tweaks])

  return (
    <div className="absolute inset-0">
      <div ref={host} className="absolute inset-0" />
      {/* 농장 길을 넘어갈 때 하얗게 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[30] bg-white transition-opacity duration-500" style={{ opacity: fade ? 1 : 0 }} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} ref={(n) => { anchors.current[i] = n }} className="pointer-events-none absolute top-0 left-0 z-[5]">
          {/* 말풍선은 2D 보다 작게(손님 머리를 가리지 않게) */}
          <div className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"><div className="origin-bottom scale-[0.62]">{bubble(i, () => approachRef.current(i))}</div></div>
        </div>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <div key={`f${i}`} ref={(n) => { floats.current[i] = n }} className="pointer-events-none absolute top-0 left-0 z-[6]">
          <div className="absolute -translate-x-1/2" style={{ top: -110 }}>{float(i)}</div>
        </div>
      ))}
    </div>
  )
}
