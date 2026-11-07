import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { renderFigure } from '../lib/exportPng'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { createStage, cuteTree, type Doll, type Stage } from './stage3d'

/**
 * 카페 3D 무대(시험판): 정원에 테이블 여덟 개와 손님(동물 친구), 가운데 카운터. 주문·서빙·전화·주방은 원래 카페 그대로.
 * 손님 머리 위 말풍선은 원래 화면의 단추를 3D 자리에 맞춰 띄운다(bubble(i) 가 그 단추). 손님을 누르면 onCall(i), 걷는 자리는 lane(0 카운터 앞·1 윗줄·2 아랫줄).
 */
/** 자리 i 의 손님 위치(윗줄 0~3, 아랫줄 4~7). 동물 그림은 CALL_ANIMALS[i](카페 손님 = 동물 i) */
const seatAt = (i: number) => new THREE.Vector3([-6, -2.6, 2.6, 6][i % 4], 0, i < 4 ? -1.5 : 3.2)
const tableAt = (i: number) => seatAt(i).clone().add(new THREE.Vector3(i % 4 < 2 ? 1.25 : -1.25, 0, 0))
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
    const s = createStage(el, {
      sky: 0xcdeeff, fog: [30, 70], orbit: true, pitchRange: [0.35, 1.05],
      view: { yaw: 0, pitch: 0.72, dist: 17, target: [0, 0.6, 0.6] },
      pickables: guests, onPick: (o) => callRef.current(guests.indexOf(o)),
      fov: (w, h) => (w < h ? 66 : 44),
    })
    stage.current = s
    const { scene, keep, lambert } = s
    // 잔디 정원 + 가운데 길 + 울타리 같은 꽃밭
    const lawn = new THREE.Mesh(keep(new THREE.PlaneGeometry(120, 120)), lambert(0x9fd47a))
    lawn.rotation.x = -Math.PI / 2
    lawn.receiveShadow = true
    scene.add(lawn)
    const path = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.4, 14)), lambert(0xf3dfb3))
    path.rotation.x = -Math.PI / 2
    path.position.set(0, 0.01, 0.4)
    path.receiveShadow = true
    scene.add(path)
    // 카운터: 분홍 지붕 가게(뒤쪽)
    const shop = new THREE.Group()
    const counter = new THREE.Mesh(keep(new THREE.BoxGeometry(7, 1.2, 1.4)), lambert(0xfff1d6))
    counter.position.y = 0.6
    const top = new THREE.Mesh(keep(new THREE.BoxGeometry(7.3, 0.15, 1.6)), lambert(0xe8a0b4))
    top.position.y = 1.25
    const back = new THREE.Mesh(keep(new THREE.BoxGeometry(7.6, 3.6, 0.4)), lambert(0xffe4ec))
    back.position.set(0, 1.8, -1.6)
    const awning = new THREE.Mesh(keep(new THREE.BoxGeometry(8, 0.2, 2.6)), lambert(0xff8fab))
    awning.position.set(0, 3.7, -0.5)
    awning.rotation.x = 0.18
    for (const m of [counter, top, back, awning]) { m.castShadow = true; m.receiveShadow = true }
    shop.add(counter, top, back, awning)
    // 줄무늬 차양: 하얀 띠
    for (let k = -3; k <= 3; k += 2) { const st = new THREE.Mesh(keep(new THREE.BoxGeometry(0.9, 0.22, 2.62)), lambert(0xffffff)); st.position.set(k, 3.7, -0.5); st.rotation.x = 0.18; shop.add(st) }
    shop.position.set(0, 0, -7.2)
    scene.add(shop)
    // 테이블·의자·파라솔
    const tableGeo = keep(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 20)), legGeo = keep(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8))
    const tableMat = lambert(0xffffff), legMat = lambert(0xd9b38c)
    const umbGeo = keep(new THREE.ConeGeometry(0.95, 0.45, 12)), poleGeo = keep(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6))
    const umbMats = [0xff9eb8, 0xffd27a, 0xa9dcc8, 0xc7a6ff].map(lambert)
    const cupGeo = keep(new THREE.CylinderGeometry(0.12, 0.09, 0.18, 12)), cupMat = lambert(0xfff6e8)
    for (let i = 0; i < 8; i++) {
      const p = tableAt(i)
      const t = new THREE.Mesh(tableGeo, tableMat)
      t.position.copy(p).setY(0.82)
      const leg = new THREE.Mesh(legGeo, legMat)
      leg.position.copy(p).setY(0.4)
      const pole = new THREE.Mesh(poleGeo, legMat)
      pole.position.copy(p).setY(1.9)
      const umb = new THREE.Mesh(umbGeo, umbMats[i % 4])
      umb.position.copy(p).setY(3.0)
      const cup = new THREE.Mesh(cupGeo, cupMat)
      cup.position.copy(p).add(new THREE.Vector3(0.25, 0.95, 0.2))
      for (const m of [t, leg, umb]) { m.castShadow = true; m.receiveShadow = true }
      scene.add(t, leg, pole, umb, cup)
    }
    // 둘레 나무·꽃
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2
      const x = Math.cos(a) * 15, z = Math.sin(a) * 11 - 2
      if (z > 6) continue
      cuteTree(s, x, z, 0.9 + (k % 3) * 0.2, [0x6cc35a, 0xffb7cf, 0x7ad06a][k % 3])
    }
    const flowerGeo = keep(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8))
    const fm = [0xff8fb1, 0xffd54a, 0xffffff, 0xc7a6ff].map(lambert)
    for (let k = 0; k < 160; k++) {
      const f = new THREE.Mesh(flowerGeo, fm[k % 4])
      const a = (k * 2.399) % (Math.PI * 2), r = 9 + (k % 7)
      f.position.set(Math.cos(a) * r * 1.2, 0.03, Math.sin(a) * r * 0.8)
      scene.add(f)
    }
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
    if (w < h) { s.view.pitch = 1.02; s.view.dist = 7.4 / Math.tan(hf / 2); s.view.target.z = -1.2 }
    s.onFrame((dt) => {
      t += dt
      const st = state.current
      const goal = LANES[st.lane]
      me.root.position.lerp(goal, Math.min(1, dt * 3.2))
      const moving = me.root.position.distanceTo(goal) > 0.05
      me.body.position.y = moving || st.walking ? Math.abs(Math.sin(t * 9)) * 0.1 : 0
      s.face(me)
      for (const d of guestDolls) s.face(d)
      if (st.hold) {
        if (!holdTex.has(st.hold)) holdTex.set(st.hold, s.texOf(assetUrl(`cafe/menu2/${st.hold}.webp`)))
        holdSprite.material.map = holdTex.get(st.hold)!
        holdSprite.material.needsUpdate = true
        holdSprite.position.copy(me.root.position).add(tmp.set(0, 1.3 + me.body.position.y, 0.35))
        holdSprite.visible = true
      } else holdSprite.visible = false
      // 말풍선·코인 표시를 손님 머리 위 화면 자리에
      for (let i = 0; i < 8; i++) {
        const pos = s.project(tmp.copy(seatAt(i)).setY(1.75))
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
