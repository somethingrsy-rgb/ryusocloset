import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { renderFigure } from '../lib/exportPng'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { createStage, type Doll, type Stage } from './stage3d'

/**
 * 카페 3D 무대(시험판): 정원에 테이블 여덟 개와 손님(동물 친구), 가운데 카운터. 주문·서빙·전화·주방은 원래 카페 그대로.
 * 손님 머리 위 말풍선은 원래 화면의 단추를 3D 자리에 맞춰 띄운다(bubble(i) 가 그 단추). 손님을 누르면 onCall(i), 걷는 자리는 lane(0 카운터 앞·1 윗줄·2 아랫줄).
 */
/** 자리 i 의 손님 위치(윗줄 0~3, 아랫줄 4~7). 동물 그림은 CALL_ANIMALS[i](카페 손님 = 동물 i) */
/** 세로 화면은 테이블을 옆으로 좁혀 놓는다(폰에서 너무 작아 보이지 않게) */
let SX = 1
const seatAt = (i: number) => new THREE.Vector3([-6, -2.6, 2.6, 6][i % 4] * SX, 0, i < 4 ? -1.5 : 3.2)
const tableAt = (i: number) => seatAt(i).clone().add(new THREE.Vector3((i % 4 < 2 ? 1.25 : -1.25) * SX, 0, 0))
const LANES = [new THREE.Vector3(0, 0, -4.6), new THREE.Vector3(0, 0, -0.6), new THREE.Vector3(0, 0, 4.1)]

export function Cafe3D({ outfit, tweaks, lane, walking, hold, onCall, bubble, float }: {
  outfit: Outfit; tweaks: Tweaks
  lane: 0 | 1 | 2; walking: boolean; hold: string | null
  onCall: (i: number) => void
  /** 손님 머리 위에 띄울 단추(원래 카페의 말풍선) */
  bubble: (i: number) => ReactNode
  /** 서빙하고 받은 코인(+3 같은) 표시 */
  float: (i: number) => ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const anchors = useRef<(HTMLDivElement | null)[]>([])
  const floats = useRef<(HTMLDivElement | null)[]>([])
  const stage = useRef<Stage | null>(null)
  const meRef = useRef<Doll | null>(null)
  const state = useRef({ lane, walking, hold })
  state.current = { lane, walking, hold }
  const callRef = useRef(onCall)
  callRef.current = onCall

  useEffect(() => {
    const el = host.current
    if (!el) return
    const guests: THREE.Object3D[] = [], guestDolls: Doll[] = []
    /** 손님이 자기 테이블 둘레를 천천히 거닐다 쉬었다 한다(말풍선도 따라간다). 자리마다 가는 곳·쉬는 시간 */
    const roam = Array.from({ length: 8 }, (_, i) => ({ tx: 0, tz: 0, wait: 1 + i * 0.6, dir: 1 as 1 | -1, t: i }))
    const s = createStage(el, {
      sky: 0xcdeeff, fog: [30, 70], orbit: true, pitchRange: [0.35, 1.05],
      view: { yaw: 0, pitch: 0.72, dist: 17, target: [0, 0.6, 0.6] },
      pickables: guests, onPick: (o) => callRef.current(guests.indexOf(o)),
      fov: (w, h) => (w < h ? 66 : 44),
    })
    stage.current = s
    SX = el.clientWidth < el.clientHeight ? 0.6 : 1
    const { scene, keep, lambert } = s
    // 그림은 받은 카페 그림(public/cafe/3d): 잔디 무늬 바닥, 가게·파라솔 테이블·나무·꽃 덤불은 그림을 세운 판
    const grassTex = s.texOf(assetUrl('cafe/3d/grass.webp'))
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping
    grassTex.repeat.set(24, 24)
    const lawn = new THREE.Mesh(keep(new THREE.PlaneGeometry(120, 120)), keep(new THREE.MeshLambertMaterial({ map: grassTex })))
    lawn.rotation.x = -Math.PI / 2
    lawn.receiveShadow = true
    scene.add(lawn)
    const path = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.4, 13)), lambert(0xf3dfb3))
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
    prop('counter', 5.6, 870 / 1024, 0, -6.2)
    // 파라솔 테이블: 손님 옆자리
    for (let i = 0; i < 8; i++) { const p = tableAt(i); prop('table', 2.1, 1024 / 967, p.x, p.z - 0.2) }
    // 둘레 나무와 꽃 덤불
    for (let k = 0; k < 16; k++) {
      const a = Math.PI + (k / 15) * Math.PI // 뒤쪽 반원
      prop('tree', 4.2 + (k % 3) * 0.5, 1024 / 1010, Math.cos(a) * 14, Math.sin(a) * 9 - 2.5)
    }
    for (const [x, z] of [[-9, -1], [9, -1], [-9.5, 3.5], [9.5, 3.5], [-4.2, -5.6], [4.2, -5.6], [-8, 7], [8, 7], [-3.5, 7.5], [3.5, 7.5]]) prop('bush', 1.25, 1024 / 755, x, z)
    // 손님: 자리마다 동물 친구(누르면 전화)
    for (let i = 0; i < 8; i++) {
      const d = s.paperDoll(s.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[i].img}_stand.webp`)), 1.55, 1)
      d.root.position.copy(seatAt(i))
      guests.push(d.root)
      guestDolls.push(d)
    }
    // 아바타
    const me = s.paperDoll(null, 2.3, 1024 / 1536, 1504 / 1536)
    me.root.position.copy(LANES[0])
    meRef.current = me
    // 들고 있는 메뉴
    const holdSprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ transparent: true })))
    holdSprite.scale.setScalar(0.75)
    holdSprite.visible = false
    scene.add(holdSprite)
    const holdTex = new Map<string, THREE.Texture>()

    let t = 0
    const tmp = new THREE.Vector3()
    // 화면 폭에 손님 여덟이 다 들어오게 거리를 맞춘다(끌어서 돌린 거리는 그대로 두고 처음 한 번)
    const { w, h } = s.size()
    const hf = 2 * Math.atan(Math.tan((s.camera.fov * Math.PI) / 360) * (w / h))
    s.view.dist = Math.max(15, 8.6 / Math.tan(hf / 2))
    // 세로 화면: 위에서 더 내려다봐서 정원이 화면 세로를 채우게
    if (w < h) { s.view.pitch = 0.9; s.view.dist = 5.6 / Math.tan(hf / 2); s.view.target.z = -0.4 }
    s.onFrame((dt) => {
      t += dt
      const st = state.current
      const goal = LANES[st.lane]
      me.root.position.lerp(goal, Math.min(1, dt * 3.2))
      const moving = me.root.position.distanceTo(goal) > 0.05
      me.body.position.y = moving || st.walking ? Math.abs(Math.sin(t * 9)) * 0.1 : 0
      s.face(me)
      for (const d of props) s.faceTilt(d)
      guestDolls.forEach((d, i) => {
        const r = roam[i], home = seatAt(i), p = d.root.position
        r.t += dt
        if (r.wait > 0) { r.wait -= dt; if (r.wait <= 0) { r.tx = home.x + (Math.random() - 0.5) * 3 * SX; r.tz = home.z + (Math.random() - 0.5) * 1.6 } }
        else {
          const dx = r.tx - p.x, dz = r.tz - p.z, dist = Math.hypot(dx, dz)
          if (dist < 0.05) r.wait = 2 + Math.random() * 4
          else { const sp = Math.min(dist, dt * 1.1); p.x += (dx / dist) * sp; p.z += (dz / dist) * sp; if (Math.abs(dx) > 0.02) r.dir = dx > 0 ? 1 : -1 }
        }
        d.body.position.y = r.wait > 0 ? 0 : Math.abs(Math.sin(r.t * 8)) * 0.08
        s.faceTilt(d, 0.4)
        d.doll.scale.x = Math.abs(d.doll.scale.x) * r.dir
      })
      if (st.hold) {
        if (!holdTex.has(st.hold)) holdTex.set(st.hold, s.texOf(assetUrl(`cafe/menu2/${st.hold}.webp`)))
        holdSprite.material.map = holdTex.get(st.hold)!
        holdSprite.material.needsUpdate = true
        holdSprite.position.copy(me.root.position).add(tmp.set(0, 1.3 + me.body.position.y, 0.35))
        holdSprite.visible = true
      } else holdSprite.visible = false
      // 말풍선·코인 표시를 손님 머리 위 화면 자리에
      for (let i = 0; i < 8; i++) {
        const pos = s.project(tmp.copy(guests[i].position).setY(1.75))
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
        <div key={i} ref={(n) => { anchors.current[i] = n }} className="pointer-events-none absolute top-0 left-0 z-[5]">
          <div className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full">{bubble(i)}</div>
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
