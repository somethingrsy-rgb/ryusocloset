import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { renderFigure } from '../lib/exportPng'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { stepCafe, type CafePoint } from '../lib/cafeWalk'
import { createStage, type Doll, type Stage } from './stage3d'

/** 기존 주문 저장을 공유하는 자유 산책 카페. 길과 잔디 모두 걸을 수 있다. */
/** 세로 화면(폰)은 테이블을 옆으로 좁혀 놓는다(양 끝 손님이 화면 밖으로 잘리지 않게) */
let SX = 1, PORTRAIT = false
/** 세로 화면은 옆으로는 조금 좁히고 앞뒤 줄 사이는 넓힌다(테이블끼리 붙어 보이지 않게) */
const seatAt = (i: number) => new THREE.Vector3([-6, -2.6, 2.6, 6][i % 4] * SX, 0, i < 4 ? (PORTRAIT ? -2.2 : -1.5) : PORTRAIT ? 4.4 : 3.2)
const tableAt = (i: number) => seatAt(i).clone().add(new THREE.Vector3((i % 4 < 2 ? 1.25 : -1.25) * SX, 0, 0))

/**
 * 파라솔 테이블 세트(입체): 하얀 동그란 테이블 + 꼬불 다리, 분홍·크림 줄무늬 파라솔(가장자리 물결 + 딸기·꽃 장식),
 * 테이블 위 꽃병, 양옆 하트 등받이 의자. 모양은 한 번 만들고 테이블마다 같이 쓴다.
 */
function makeTableKit(s: Stage) {
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

export function Cafe3D({ outfit, tweaks, walking, hold, paused, encounters, onMeet, bubble, float, eating }: {
  outfit: Outfit; tweaks: Tweaks
  walking: boolean; hold: string | null; paused: boolean
  /** 서빙받은 손님이 들고 있는 음식(자리 → 메뉴). 들고 있는 동안은 자리에 앉아 있고 말풍선은 숨긴다 */
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
  const stage = useRef<Stage | null>(null)
  const meRef = useRef<Doll | null>(null)
  const state = useRef({ walking, hold, paused, encounters, onMeet, eating })
  state.current = { walking, hold, paused, encounters, onMeet, eating }
  const approachRef = useRef<(i: number) => void>(() => {})

  useEffect(() => {
    const el = host.current
    if (!el) return
    PORTRAIT = el.clientWidth < el.clientHeight
    SX = PORTRAIT ? 0.8 : 1
    const guests: THREE.Object3D[] = [], guestDolls: Doll[] = []
    let target: CafePoint | null = null, following: number | null = null
    const approach = (i: number) => { if (!state.current.paused) { following = i; target = null } }
    approachRef.current = approach
    const s = createStage(el, {
      sky: 0xcdeeff, fog: [30, 70], orbit: true, pitchRange: [0.55, 1.0],
      // 그림 판(가게·테이블·나무)은 늘 앞을 보고 있어서, 옆으로는 조금(약 20도)만 돌려 본다
      yawRange: [-0.35, 0.35],
      view: { yaw: 0, pitch: 0.72, dist: 17, target: [0, 0.6, 0.6] },
      pickables: guests, onPick: (o) => approach(guests.indexOf(o)),
      onTap: (x, y) => {
        if (state.current.paused) return
        const p = s.ground(x, y)
        if (p) { following = null; target = { x: Math.max(-8.5 * SX, Math.min(8.5 * SX, p.x)), z: Math.max(-4.8, Math.min(6.5, p.z)) } }
      },
      fov: (w, h) => (w < h ? 66 : 44),
    })
    stage.current = s
    const { scene, keep } = s
    // 그림은 받은 카페 그림(public/cafe/3d): 잔디 무늬 바닥, 가게·파라솔 테이블·나무·꽃 덤불은 그림을 세운 판
    const grassTex = s.texOf(assetUrl('cafe/3d/grass.webp'))
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping
    grassTex.repeat.set(14, 14)
    const lawn = new THREE.Mesh(keep(new THREE.PlaneGeometry(120, 120)), keep(new THREE.MeshLambertMaterial({ map: grassTex })))
    lawn.rotation.x = -Math.PI / 2
    lawn.receiveShadow = true
    scene.add(lawn)
    const dirtTex = s.texOf(assetUrl('cafe/3d/dirt.webp'))
    dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping
    dirtTex.repeat.set(1, 5)
    const path = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.4, 13)), keep(new THREE.MeshLambertMaterial({ map: dirtTex })))
    path.rotation.x = -Math.PI / 2
    path.position.set(0, 0.01, 0.2)
    path.receiveShadow = true
    scene.add(path)
    const props: Doll[] = []
    const prop = (name: string, h: number, aspect: number, x: number, z: number) => {
      const d = s.paperDoll(s.texOf(assetUrl(`cafe/3d/${name}.webp`)), h, aspect)
      d.root.position.set(x, 0, z)
      props.push(d)
      return d
    }
    // 딸기 가게(카운터): 뒤쪽 가운데
    prop('counter', 5.6, 997 / 1024, 0, -6.2)
    // 파라솔 테이블: 손님 옆자리
    // 파라솔 테이블: 받은 그림과 같은 색·모양을 진짜 입체로(어느 쪽에서 봐도 두께가 있게)
    const tableKit = makeTableKit(s)
    for (let i = 0; i < 8; i++) {
      const p = tableAt(i), g = tableKit(i)
      g.position.set(p.x, 0, p.z - 0.2)
      scene.add(g)
    }
    // 둘레 나무와 꽃 덤불
    for (let k = 0; k < 16; k++) {
      const a = Math.PI + (k / 15) * Math.PI // 뒤쪽 반원
      prop('tree', 4.2 + (k % 3) * 0.5, 951 / 1024, Math.cos(a) * 14, Math.sin(a) * 9 - 2.5)
    }
    for (const [x, z] of [[-9, -1], [9, -1], [-9.5, 3.5], [9.5, 3.5], [-4.2, -5.6], [4.2, -5.6], [-8, 7], [8, 7], [-3.5, 7.5], [3.5, 7.5]]) prop('bush', 1.15, 1024 / 616, x, z)
    // 손님: 자리마다 동물 친구(누르면 전화)
    for (let i = 0; i < 8; i++) {
      const d = s.paperDoll(s.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[i].img}_stand.webp`)), 1.55, 1)
      d.root.position.copy(seatAt(i))
      guests.push(d.root)
      guestDolls.push(d)
    }
    // 손님이 받은 음식(손 앞에 든다)
    const foods = guestDolls.map(() => { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ transparent: true }))); sp.scale.setScalar(0.85); sp.renderOrder = 5; sp.visible = false; scene.add(sp); return sp })
    // 아바타
    const me = s.paperDoll(null, 2.3, 1024 / 1536, 1504 / 1536)
    me.root.position.set(0, 0, -4.6)
    meRef.current = me
    // 들고 있는 메뉴
    const holdSprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ transparent: true })))
    holdSprite.scale.setScalar(0.75)
    holdSprite.visible = false
    scene.add(holdSprite)
    const holdTex = new Map<string, THREE.Texture>()

    const obstacles = Array.from({ length: 8 }, (_, i) => { const p = tableAt(i); return { x: p.x, z: p.z - 0.2, r: 0.7 } })
    const roam = guestDolls.map((d, i) => ({ goal: { x: d.root.position.x, z: d.root.position.z }, wait: i * 0.45, met: '', dir: 1 as 1 | -1 }))
    let t = 0, direction: 1 | -1 = 1
    const tmp = new THREE.Vector3()
    // 화면 폭에 손님 여덟이 다 들어오게 거리를 맞춘다(끌어서 돌린 거리는 그대로 두고 처음 한 번)
    const { w, h } = s.size()
    const hf = 2 * Math.atan(Math.tan((s.camera.fov * Math.PI) / 360) * (w / h))
    s.view.dist = Math.max(15, 8.6 / Math.tan(hf / 2))
    // 세로 화면: 위에서 더 내려다봐서 정원이 화면 세로를 채우게
    if (w < h) { s.view.pitch = 0.9; s.view.dist = 6.4 / Math.tan(hf / 2); s.view.target.z = 0 }
    // 그림 판은 앞(+z)을 보게 고정하고, 처음 시점만큼만 뒤로 살짝 눕힌다(돌려 봐도 가게·의자가 따라 돌지 않게)
    for (const d of props) { d.body.rotation.order = 'YXZ'; d.body.rotation.set(-s.view.pitch * 0.5, 0, 0) }
    s.onFrame((dt) => {
      t += dt
      const st = state.current
      const frozen = st.paused || st.walking
      let moving = false
      // 손님: 주문한 손님(만드는 중·완성)은 자리로 돌아와 앉아 기다리고, 주문 전 손님은 절반만 돌아다닌다(짝수 자리)
      for (let i = 0; i < guestDolls.length; i++) {
        const d = guestDolls[i], r = roam[i], p = d.root.position
        const near = p.distanceTo(me.root.position) < 1.5
        const sits = !st.encounters[i].startsWith('new:') || i % 2 === 1 || !!st.eating[i]
        const seat = seatAt(i)
        if (sits) { r.goal = { x: seat.x, z: seat.z }; r.wait = 0 }
        let stepped = false
        if (!frozen && !near && following !== i) {
          r.wait -= dt
          if (!sits && r.wait <= 0 && Math.hypot(p.x - r.goal.x, p.z - r.goal.z) < 0.15) {
            // 다른 손님 자리·지금 있는 곳과 떨어진 빈 곳을 고른다
            for (let k = 0; k < 8; k++) {
              const g = { x: (Math.random() - 0.5) * 15 * SX, z: -3.8 + Math.random() * 9.5 }
              if (guestDolls.every((o, j) => j === i || Math.hypot(o.root.position.x - g.x, o.root.position.z - g.z) > 1.6)) { r.goal = g; break }
            }
            r.wait = 1.5 + Math.random() * 2.5
          }
          if (r.wait <= 0 && Math.hypot(p.x - r.goal.x, p.z - r.goal.z) > 0.05) {
            const prev = p.x
            const next = stepCafe(p, r.goal, 0.65 * dt, obstacles)
            p.set(next.x, 0, next.z)
            if (Math.abs(next.x - prev) > 0.001) r.dir = next.x > prev ? 1 : -1
            stepped = true
            if (!sits && Math.hypot(next.x - r.goal.x, next.z - r.goal.z) < 0.15) r.wait = 1.5 + Math.random() * 2.5
          }
        }
        // 부딪히지 않게: 다른 손님·아바타와 1 이상 떨어진다(앉은 손님은 자리를 지키고 걷는 손님이 비킨다)
        if (!sits) for (const o of [...guestDolls.filter((_, j) => j !== i).map((x) => x.root.position), me.root.position]) {
          const dx = p.x - o.x, dz = p.z - o.z, dd = Math.hypot(dx, dz)
          if (dd < 1 && dd > 1e-3) { p.x = o.x + (dx / dd) * 1; p.z = o.z + (dz / dd) * 1 }
        }
        d.body.position.y = stepped ? Math.abs(Math.sin(t * 7 + i)) * 0.06 : 0
        s.face(d, r.dir)
        if (!near && p.distanceTo(me.root.position) > 2.1) r.met = ''
      }
      if (!frozen) {
        const goal = following !== null ? guestDolls[following].root.position : target
        if (goal && Math.hypot(goal.x - me.root.position.x, goal.z - me.root.position.z) > (following !== null ? 1.2 : 0.08)) {
          const prev = me.root.position.clone()
          const next = stepCafe(prev, goal, 3.2 * dt, obstacles)
          me.root.position.set(next.x, 0, next.z)
          moving = prev.distanceTo(me.root.position) > 0.001
          if (Math.abs(next.x - prev.x) > 0.001) direction = next.x > prev.x ? 1 : -1
        } else if (following === null) target = null
        // 한 번 만난 손님은 멀어졌다 다시 만나거나 주문 상태가 바뀌어야 다시 접객한다.
        const i = guestDolls.findIndex((d, i) => st.encounters[i] && d.root.position.distanceTo(me.root.position) < 1.5 && roam[i].met !== st.encounters[i] && !(roam[i].met.startsWith('ready:') && st.encounters[i].startsWith('new:')))
        if (i >= 0) {
          roam[i].met = st.encounters[i]
          target = null; following = null
          st.onMeet(i)
        }
      }
      me.body.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.1 : 0
      s.face(me, direction)
      if (st.hold) {
        if (!holdTex.has(st.hold)) holdTex.set(st.hold, s.texOf(assetUrl(`cafe/menu2/${st.hold}.webp`)))
        holdSprite.material.map = holdTex.get(st.hold)!
        holdSprite.material.needsUpdate = true
        holdSprite.position.copy(me.root.position).add(tmp.set(0, 1.3 + me.body.position.y, 0.35))
        holdSprite.visible = true
      } else holdSprite.visible = false
      // 받은 음식: 손님 손 앞에서 냠냠(살짝 통통)
      foods.forEach((sp, i) => {
        const id = st.eating[i]
        sp.visible = !!id
        if (!id) return
        if (!holdTex.has(id)) holdTex.set(id, s.texOf(assetUrl(`cafe/menu2/${id}.webp`)))
        if (sp.material.map !== holdTex.get(id)) { sp.material.map = holdTex.get(id)!; sp.material.needsUpdate = true }
        sp.position.copy(guestDolls[i].root.position).add(tmp.set(0, 0.8 + Math.abs(Math.sin(t * 4 + i)) * 0.06, 0.5))
      })
      // 말풍선·코인 표시를 손님 머리 위 화면 자리에(음식을 들고 있는 동안은 말풍선을 숨긴다)
      for (let i = 0; i < 8; i++) {
        const pos = s.project(tmp.copy(guestDolls[i].root.position).setY(1.6))
        const a = anchors.current[i], f = floats.current[i]
        if (a) { a.style.transform = `translate(${pos.x}px, ${pos.y}px)`; a.style.visibility = pos.front && !st.eating[i] ? 'visible' : 'hidden' }
        if (f) { f.style.transform = `translate(${pos.x}px, ${pos.y}px)`; f.style.visibility = pos.front ? 'visible' : 'hidden' }
      }
    })
    return () => { stage.current = null; meRef.current = null; s.dispose() }
  }, [])

  useEffect(() => {
    let alive = true
    renderFigure(outfit, tweaks).then((cv) => { const s = stage.current, me = meRef.current; if (alive && s && me) s.setMap(me, s.texOf(cv)) }).catch(() => {})
    return () => { alive = false }
  }, [outfit, tweaks])

  return (
    <div className="absolute inset-0">
      <div ref={host} className="absolute inset-0" />
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
