import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { renderFigure } from '../lib/exportPng'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { CAFE_SEATED_COUNT, nearestCafeGuest, stepCafeCrowd, type CafePoint } from '../lib/cafeWalk'
import { createStage, type Doll, type Stage } from './stage3d'

/** 기존 주문 저장을 공유하는 자유 산책 카페. 길과 잔디 모두 걸을 수 있다. */
const TABLES = [new THREE.Vector3(-4.6, 0, -1.6), new THREE.Vector3(4.6, 0, -1.6), new THREE.Vector3(-4.6, 0, 3.5), new THREE.Vector3(4.6, 0, 3.5)]
const seatAt = (i: number) => i < CAFE_SEATED_COUNT
  ? TABLES[i].clone().add(new THREE.Vector3(i % 2 ? -0.75 : 0.75, 0, -0.35))
  : [new THREE.Vector3(-6.8, 0, 0.6), new THREE.Vector3(-2, 0, 5.6), new THREE.Vector3(0, 0, 0.1), new THREE.Vector3(5.2, 0, 5.4)][i - CAFE_SEATED_COUNT].clone()

export function Cafe3D({ outfit, tweaks, walking, hold, paused, encounters, onMeet, bubble, float }: {
  outfit: Outfit; tweaks: Tweaks
  walking: boolean; hold: string | null; paused: boolean
  encounters: string[]; onMeet: (i: number) => void
  /** 손님 머리 위에 띄울 단추(원래 카페의 말풍선) */
  bubble: (i: number, approach: () => void, compact: boolean) => ReactNode
  /** 서빙하고 받은 코인(+3 같은) 표시 */
  float: (i: number) => ReactNode
}) {
  const [nearGuest, setNearGuest] = useState<number | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const anchors = useRef<(HTMLDivElement | null)[]>([])
  const floats = useRef<(HTMLDivElement | null)[]>([])
  const stage = useRef<Stage | null>(null)
  const meRef = useRef<Doll | null>(null)
  const state = useRef({ walking, hold, paused, encounters, onMeet })
  state.current = { walking, hold, paused, encounters, onMeet }
  const approachRef = useRef<(i: number) => void>(() => {})

  useEffect(() => {
    const el = host.current
    if (!el) return
    let layoutScale = el.clientWidth < el.clientHeight ? 0.65 : 1
    const guests: THREE.Object3D[] = [], guestDolls: Doll[] = []
    let target: CafePoint | null = null, following: number | null = null
    const approach = (i: number) => { if (!state.current.paused) { following = i; target = null } }
    approachRef.current = approach
    const s = createStage(el, {
      sky: 0xcdeeff, fog: [30, 70], orbit: false,
      view: { yaw: -0.22, pitch: 0.54, dist: 19, target: [0, 0.8, 0.5] },
      pickables: guests, onPick: (o) => approach(guests.indexOf(o)),
      onTap: (x, y) => {
        if (state.current.paused) return
        const p = s.ground(x, y)
        if (p) { following = null; target = { x: Math.max(-8.5 * layoutScale, Math.min(8.5 * layoutScale, p.x)), z: Math.max(-4.8, Math.min(6.5, p.z)) } }
      },
      fov: (w, h) => (w < h ? 54 : 44),
    })
    stage.current = s
    const { scene, keep } = s
    // 그림은 받은 카페 그림(public/cafe/3d): 잔디 무늬 바닥, 가게·파라솔 테이블·나무·꽃 덤불은 그림을 세운 판
    const grassTex = s.texOf(assetUrl('cafe/3d/grass.webp'))
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping
    grassTex.repeat.set(24, 24)
    const lawn = new THREE.Mesh(keep(new THREE.PlaneGeometry(120, 120)), keep(new THREE.MeshLambertMaterial({ map: grassTex })))
    lawn.rotation.x = -Math.PI / 2
    lawn.receiveShadow = true
    scene.add(lawn)
    const dirtTex = s.texOf(assetUrl('cafe/3d/dirt.jpg'))
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
      d.root.position.set(x * layoutScale, 0, z)
      props.push(d)
      // 배경 그림판은 고정된 방향으로 세운다. 매 프레임 카메라를 따라 돌리지 않는다.
      d.body.rotation.set(-0.18, -0.22, 0, 'YXZ')
      return d
    }
    // 딸기 가게(카운터): 뒤쪽 가운데
    prop('counter', 5.6, 870 / 1024, 0, -6.2)
    // 테이블 네 개: 자리에 머무는 손님마다 한 자리
    for (const p of TABLES) { prop('table', 2.1, 1024 / 967, p.x, p.z - 0.2) }
    // 둘레 나무와 꽃 덤불
    for (let k = 0; k < 16; k++) {
      const a = Math.PI + (k / 15) * Math.PI // 뒤쪽 반원
      prop('tree', 4.2 + (k % 3) * 0.5, 1024 / 1010, Math.cos(a) * 14, Math.sin(a) * 9 - 2.5)
    }
    for (const [x, z] of [[-9, -1], [9, -1], [-9.5, 3.5], [9.5, 3.5], [-4.2, -5.6], [4.2, -5.6], [-8, 7], [8, 7], [-3.5, 7.5], [3.5, 7.5]]) prop('bush', 1.25, 1024 / 755, x, z)
    // 네 손님은 테이블 뒤 의자 자리에 머물고, 나머지 네 손님만 정원을 걷는다.
    for (let i = 0; i < 8; i++) {
      const d = s.paperDoll(s.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[i].img}_stand.webp`)), i < CAFE_SEATED_COUNT ? 1.35 : 1.55, 1)
      d.root.position.copy(seatAt(i))
      d.root.position.x *= layoutScale
      if (i < CAFE_SEATED_COUNT) d.body.position.y = 0.18
      guests.push(d.root)
      guestDolls.push(d)
    }
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

    const obstacles = [...TABLES.map(p => ({ x: p.x * layoutScale, z: p.z - 0.2, r: 0.75 })), { x: 0, z: -6.2, r: 1.7 }]
    const blockers = (i: number) => guestDolls.filter((_, j) => i !== j).map(d => d.root.position)
    const roam = guestDolls.map((d, i) => ({ goal: { x: d.root.position.x, z: d.root.position.z }, wait: i * 0.45, met: '', dir: 1 as 1 | -1 }))
    let t = 0, direction: 1 | -1 = 1
    const tmp = new THREE.Vector3()
    let viewportW = 0, viewportH = 0
    let expanded: number | null = null
    const frameView = () => {
      const { w, h } = s.size()
      if (viewportW === w && viewportH === h) return
      const nextScale = w < h ? 0.65 : 1
      if (nextScale !== layoutScale) {
        const ratio = nextScale / layoutScale
        for (const d of [...props, ...guestDolls, me]) d.root.position.x *= ratio
        for (const o of obstacles) o.x *= ratio
        for (const r of roam) r.goal.x *= ratio
        if (target) target.x *= ratio
        layoutScale = nextScale
      }
      viewportW = w; viewportH = h
      const hf = 2 * Math.atan(Math.tan((s.camera.fov * Math.PI) / 360) * (w / h))
      s.view.dist = Math.max(18, (w < h ? 5.9 : 8.7) / Math.tan(hf / 2))
      s.view.target.set(0, 0.8, 0.5)
    }
    frameView()
    s.onFrame((dt) => {
      t += dt
      frameView()
      const st = state.current
      const frozen = st.paused || st.walking
      let moving = false
      for (let i = 0; i < guestDolls.length; i++) {
        const d = guestDolls[i], r = roam[i]
        const near = d.root.position.distanceTo(me.root.position) < 1.85
        if (i >= CAFE_SEATED_COUNT && !st.paused && !near && following !== i) {
          r.wait -= dt
          if (r.wait <= 0 && Math.hypot(d.root.position.x - r.goal.x, d.root.position.z - r.goal.z) < 0.15) {
            r.goal = { x: (Math.random() - 0.5) * (layoutScale < 1 ? 11 : 15) * layoutScale, z: -3.8 + Math.random() * 9.5 }
            r.wait = 1 + Math.random() * 2
          }
          if (r.wait <= 0) {
            const prev = d.root.position.clone()
            const next = stepCafeCrowd(d.root.position, r.goal, 0.48 * dt, obstacles, [...blockers(i), me.root.position])
            d.root.position.set(next.x, 0, next.z)
            if (Math.abs(next.x - prev.x) > 0.001) r.dir = next.x > prev.x ? 1 : -1
            const moved = Math.hypot(next.x - prev.x, next.z - prev.z) > 0.001
            d.body.position.y = moved ? Math.abs(Math.sin(t * 7 + i)) * 0.04 : 0
            if (!moved) { r.wait = 0.6 + Math.random() * 0.8; r.goal = { x: next.x, z: next.z } }
            if (Math.hypot(next.x - r.goal.x, next.z - r.goal.z) < 0.15) r.wait = 1 + Math.random() * 2
          }
        } else d.body.position.y = i < CAFE_SEATED_COUNT ? 0.18 : 0
        s.face(d, r.dir)
        if (!near && d.root.position.distanceTo(me.root.position) > 2.35) r.met = ''
      }
      if (!frozen) {
        const goal = following !== null ? guestDolls[following].root.position : target
        if (goal && Math.hypot(goal.x - me.root.position.x, goal.z - me.root.position.z) > (following !== null ? 1.7 : 0.08)) {
          const prev = me.root.position.clone()
          const next = stepCafeCrowd(prev, goal, 3.2 * dt, obstacles, guestDolls.map(d => d.root.position))
          me.root.position.set(next.x, 0, next.z)
          moving = prev.distanceTo(me.root.position) > 0.001
          if (Math.abs(next.x - prev.x) > 0.001) direction = next.x > prev.x ? 1 : -1
        } else if (following === null) target = null
        // 한 번 만난 손님은 멀어졌다 다시 만나거나 주문 상태가 바뀌어야 다시 접객한다.
        const i = guestDolls.findIndex((d, i) => st.encounters[i] && d.root.position.distanceTo(me.root.position) < 1.85 && roam[i].met !== st.encounters[i] && !(roam[i].met.startsWith('ready:') && st.encounters[i].startsWith('new:')))
        if (i >= 0) {
          roam[i].met = st.encounters[i]
          target = null; following = null
          st.onMeet(i)
        }
      }
      me.body.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.1 : 0
      s.face(me, direction)
      const closest = nearestCafeGuest(me.root.position, guestDolls.map(d => d.root.position))
      if (closest !== expanded) { expanded = closest; setNearGuest(closest) }
      if (st.hold) {
        if (!holdTex.has(st.hold)) holdTex.set(st.hold, s.texOf(assetUrl(`cafe/menu2/${st.hold}.webp`)))
        holdSprite.material.map = holdTex.get(st.hold)!
        holdSprite.material.needsUpdate = true
        holdSprite.position.copy(me.root.position).add(tmp.set(0, 1.3 + me.body.position.y, 0.35))
        holdSprite.visible = true
      } else holdSprite.visible = false
      // 말풍선·코인 표시를 손님 머리 위 화면 자리에
      for (let i = 0; i < 8; i++) {
        const pos = s.project(tmp.copy(guestDolls[i].root.position).setY(1.75))
        for (const node of [anchors.current[i], floats.current[i]]) if (node) { node.style.transform = `translate(${pos.x}px, ${pos.y}px)`; node.style.visibility = pos.front ? 'visible' : 'hidden' }
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
        <div key={i} data-guest={i} data-seated={i < CAFE_SEATED_COUNT} ref={(n) => { anchors.current[i] = n }} className="pointer-events-none absolute top-0 left-0 z-[5]">
          <div className="pointer-events-auto absolute w-max -translate-x-1/2 -translate-y-full">{bubble(i, () => approachRef.current(i), nearGuest !== i)}</div>
        </div>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <div key={`f${i}`} ref={(n) => { floats.current[i] = n }} className="pointer-events-none absolute top-0 left-0 z-[6]">
          <div className="absolute -translate-x-1/2" style={{ top: -60 }}>{float(i)}</div>
        </div>
      ))}
    </div>
  )
}
