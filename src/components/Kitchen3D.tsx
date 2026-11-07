import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { renderFigure } from '../lib/exportPng'
import { guestLook } from '../lib/guestLooks'
import { assetUrl } from '../lib/items'
import { guestAvatar } from '../lib/party'
import type { Station } from '../lib/recipes'
import type { Outfit, Tweaks } from '../lib/types'
import { createStage, type Doll, type Stage } from './stage3d'

/**
 * 주방 3D 무대(시험판): 냉장고·싱크대·가스레인지(냄비)·오븐·아일랜드(도마)를 3D 로 세우고, 아바타와 같이 요리하는 친구는 아일랜드 뒤에 선다.
 * 주문서 고르기·요리 단계·누르는 횟수·완성·마트는 원래 주방 그대로이고, 여기서는 그림만 그린다.
 * 자리(냉장고 등)를 누르면 onStation(자리) — 원래 주방의 같은 일을 한다. 지금 누를 곳은 반짝이고 손가락이 콕콕 가리킨다.
 */
export interface KitchenView {
  here: Station | null; shake: Station | null; step: string | null; taps: number
  board: string[]; sink: string[]; done: string | null; tool: string | null
  crew: number[]; cheer: boolean; busy: boolean; speaker: number
}
// 자리(바닥 위 가운데 x·z, 크기 w·h·d)
const AT: Record<Station, { x: number; z: number; w: number; h: number; d: number; color: number }> = {
  fridge: { x: -4.4, z: -2.2, w: 1.8, h: 3.4, d: 1.4, color: 0xf6f3ff },
  sink: { x: -1.4, z: -2.2, w: 2.4, h: 1.5, d: 1.4, color: 0xfff1e3 },
  stove: { x: 1.6, z: -2.2, w: 2.0, h: 1.5, d: 1.4, color: 0xfff1e3 },
  oven: { x: 4.2, z: -2.2, w: 2.0, h: 1.5, d: 1.4, color: 0xffd6de },
  board: { x: 0, z: 1.6, w: 4.6, h: 1.4, d: 1.6, color: 0xf7d9b5 },
}
const IN_FRONT = 1.0 // 아바타·친구가 서는 줄(아일랜드 뒤)

export function Kitchen3D({ outfit, tweaks, view, onStation, line }: { outfit: Outfit; tweaks: Tweaks; view: KitchenView; onStation: (s: Station) => void; line: string | null }) {
  const host = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const stage = useRef<Stage | null>(null)
  const meRef = useRef<Doll | null>(null)
  const v = useRef(view)
  v.current = view
  const tapRef = useRef(onStation)
  tapRef.current = onStation
  const lineRef = useRef(line)
  lineRef.current = line

  useEffect(() => {
    const el = host.current
    if (!el) return
    const picks: THREE.Object3D[] = []
    const s = createStage(el, {
      sky: 0xffeef2, orbit: true, pitchRange: [0.2, 0.95], yawRange: [-0.6, 0.6],
      view: { yaw: 0, pitch: 0.42, dist: 12, target: [0, 1.2, 0] },
      pickables: picks, onPick: (o) => tapRef.current(o.userData.station as Station),
      fov: (w, h) => (w < h ? 66 : 46),
    })
    stage.current = s
    const { scene, keep, lambert } = s
    {
      const { w, h } = s.size()
      const hf = 2 * Math.atan(Math.tan((s.camera.fov * Math.PI) / 360) * (w / h))
      s.view.dist = Math.max(9, 6.4 / Math.tan(hf / 2))
    }
    // 방: 나무 바닥 + 분홍 타일 벽
    const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(16, 10)), lambert(0xe2b98f))
    floor.rotation.x = -Math.PI / 2
    floor.position.z = 1
    floor.receiveShadow = true
    const tc = document.createElement('canvas'); tc.width = tc.height = 64
    const tg = tc.getContext('2d')!
    tg.fillStyle = '#ffdfe7'; tg.fillRect(0, 0, 64, 64); tg.strokeStyle = '#ffffff'; tg.lineWidth = 4; tg.strokeRect(0, 0, 64, 64)
    const tile = s.texOf(tc); tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(16, 7)
    const wall = new THREE.Mesh(keep(new THREE.PlaneGeometry(16, 7)), keep(new THREE.MeshLambertMaterial({ map: tile })))
    wall.position.set(0, 3.5, -3)
    wall.receiveShadow = true
    scene.add(floor, wall)
    // 선반
    const shelf = new THREE.Mesh(keep(new THREE.BoxGeometry(5, 0.15, 0.6)), lambert(0xd9a77c))
    shelf.position.set(0.2, 3.4, -2.7)
    scene.add(shelf)
    // 자리마다 상자 + 꾸밈
    const boxes: Partial<Record<Station, THREE.Group>> = {}
    for (const [k, a] of Object.entries(AT) as [Station, (typeof AT)[Station]][]) {
      const g = new THREE.Group()
      const body = new THREE.Mesh(keep(new THREE.BoxGeometry(a.w, a.h, a.d)), keep(new THREE.MeshLambertMaterial({ color: a.color, emissive: 0xff7aa0, emissiveIntensity: 0 })))
      body.position.y = a.h / 2
      body.castShadow = true; body.receiveShadow = true
      g.add(body)
      const topY = a.h
      if (k === 'fridge') {
        const line = new THREE.Mesh(keep(new THREE.BoxGeometry(a.w, 0.05, 0.02)), lambert(0xc9c3e6)); line.position.set(0, a.h * 0.62, a.d / 2 + 0.01); g.add(line)
        for (const y of [a.h * 0.8, a.h * 0.4]) { const hd = new THREE.Mesh(keep(new THREE.BoxGeometry(0.08, 0.5, 0.08)), lambert(0xb7aee0)); hd.position.set(a.w / 2 - 0.25, y, a.d / 2 + 0.06); g.add(hd) }
      } else {
        const top = new THREE.Mesh(keep(new THREE.BoxGeometry(a.w + 0.12, 0.12, a.d + 0.12)), lambert(k === 'board' ? 0xffffff : 0xf3e6da))
        top.position.y = topY + 0.06; top.receiveShadow = true; g.add(top)
      }
      if (k === 'sink') {
        const basin = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 0.05, 0.8)), lambert(0x9fc6e0)); basin.position.set(0, topY + 0.13, 0.05); g.add(basin)
        const tap = new THREE.Mesh(keep(new THREE.TorusGeometry(0.28, 0.05, 8, 16, Math.PI)), lambert(0xc0c6cf)); tap.position.set(0, topY + 0.4, -0.45); g.add(tap)
      }
      if (k === 'stove') {
        const pot = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.5, 0.42, 0.55, 20)), lambert(0xe46a7e)); pot.position.set(0, topY + 0.4, 0); pot.castShadow = true; g.add(pot)
        const lid = new THREE.Mesh(keep(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), lambert(0xf28a9c)); lid.scale.y = 0.3; lid.position.set(0, topY + 0.68, 0); g.add(lid)
      }
      if (k === 'oven') {
        const glass = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.3, 0.6)), lambert(0x4a3a40)); glass.position.set(0, a.h * 0.48, a.d / 2 + 0.01); g.add(glass)
      }
      if (k === 'board') {
        const board = new THREE.Mesh(keep(new THREE.BoxGeometry(2.4, 0.08, 1.0)), lambert(0xd9a066)); board.position.set(0, topY + 0.16, 0.1); board.receiveShadow = true; g.add(board)
      }
      g.position.set(a.x, 0, a.z)
      g.userData.station = k
      g.userData.body = body
      scene.add(g)
      picks.push(g)
      boxes[k] = g
    }
    // 아바타(아일랜드 뒤 가운데)와 같이 요리하는 친구(양옆)
    const me = s.paperDoll(null, 2.6, 1024 / 1536, 1504 / 1536, false)
    me.root.position.set(0, 0, IN_FRONT - 0.3)
    meRef.current = me
    const helpers: Doll[] = []
    let crewKey = ''
    const buildCrew = (crew: number[]) => {
      for (const d of helpers) scene.remove(d.root)
      helpers.length = 0
      crew.forEach((g, k) => {
        const av = guestAvatar(g)
        const d = av ? s.paperDoll(null, 2.6, 1024 / 1536, 1504 / 1536, false) : s.paperDoll(s.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[g].img}_stand.webp`)), 1.7, 1, 1, false)
        if (av) renderFigure(guestLook(av.id), {}, av).then((cv) => s.setMap(d, s.texOf(cv))).catch(() => {})
        d.root.position.set(k ? 2.6 : -2.6, 0, IN_FRONT - 0.3)
        d.root.userData.wave = av ? null : s.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[g].img}_wave.webp`))
        d.root.userData.stand = d.mat.map
        helpers.push(d)
      })
    }
    // 효과 그림
    const sprite = (src: string, size: number) => { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: s.texOf(assetUrl(src)), depthTest: false }))); sp.scale.setScalar(size); sp.renderOrder = 5; sp.visible = false; scene.add(sp); return sp }
    const point = sprite('kitchen/point.webp', 0.9)
    const flames = [0, 1, 2].map(() => sprite('kitchen/fire.webp', 0.45))
    const drops = [0, 1].map(() => sprite('kitchen/drop.svg', 0.22))
    const ice = sprite('kitchen/ice.webp', 0.8)
    const texCache = new Map<string, THREE.Texture>()
    const texFor = (src: string) => { if (!texCache.has(src)) texCache.set(src, s.texOf(assetUrl(src))); return texCache.get(src)! }
    const pool: THREE.Sprite[] = []
    const tool = new THREE.Sprite(keep(new THREE.SpriteMaterial({ depthTest: false }))); tool.renderOrder = 6; tool.visible = false; scene.add(tool)
    const doneSp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ depthTest: false }))); doneSp.renderOrder = 6; doneSp.visible = false; doneSp.scale.setScalar(0.9); scene.add(doneSp)
    const top = (k: Station) => new THREE.Vector3(AT[k].x, AT[k].h + 0.2, AT[k].z)

    let t = 0
    const tmp = new THREE.Vector3()
    let lastTaps = 0, press = 0
    s.onFrame((dt) => {
      t += dt
      const st = v.current
      const key = st.crew.join()
      if (key !== crewKey) { crewKey = key; buildCrew(st.crew) }
      if (st.taps !== lastTaps) { lastTaps = st.taps; press = 1 }
      press = Math.max(0, press - dt * 5)
      // 지금 누를 곳: 반짝이고 손가락이 위에서 콕콕. 틀린 곳을 누르면 그 자리가 흔들린다
      for (const k of Object.keys(boxes) as Station[]) {
        const g = boxes[k]!, body = g.userData.body as THREE.Mesh
        ;(body.material as THREE.MeshLambertMaterial).emissiveIntensity = st.here === k ? 0.18 + Math.sin(t * 6) * 0.12 : 0
        g.position.x = AT[k].x + (st.shake === k ? Math.sin(t * 50) * 0.06 : 0)
        g.scale.y = st.here === k ? 1 - press * 0.03 : 1
      }
      point.visible = !!st.here
      if (st.here) point.position.copy(top(st.here)).add(tmp.set(0, 0.9 + Math.abs(Math.sin(t * 5)) * 0.25, 0))
      // 불꽃: 끓이기·녹이기는 냄비 밑, 굽기는 오븐 창
      const fire = st.step === 'boil' || st.step === 'melt' ? 'stove' : st.step === 'bake' ? 'oven' : null
      flames.forEach((f, i) => {
        f.visible = !!fire
        if (!fire) return
        const a = AT[fire]
        f.position.set(a.x + (i - 1) * 0.4, fire === 'oven' ? a.h * 0.48 : a.h + 0.15, a.z + a.d / 2 + 0.05)
        f.scale.setScalar((fire === 'oven' ? 0.4 : 0.35) * (1 + 0.1 * Math.sin(t * 12 + i)) * (1 + st.taps * 0.05))
      })
      // 씻기: 물방울이 떨어진다, 굳히기: 냉장고에 얼음
      drops.forEach((d, i) => {
        d.visible = st.step === 'wash'
        const y = ((t * 1.6 + i * 0.5) % 1)
        d.position.set(AT.sink.x, AT.sink.h + 0.55 - y * 0.4, AT.sink.z - 0.3)
      })
      ice.visible = st.step === 'chill'
      ice.position.set(AT.fridge.x, AT.fridge.h * 0.8, AT.fridge.z + AT.fridge.d / 2 + 0.3)
      // 재료: 도마 위에 줄지어, 씻는 재료는 싱크대 안
      const items = [...st.board.map((src) => ({ src, at: 'board' as const })), ...st.sink.map((src) => ({ src, at: 'sink' as const }))]
      while (pool.length < items.length) { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ depthTest: false }))); sp.renderOrder = 5; scene.add(sp); pool.push(sp) }
      pool.forEach((sp, i) => {
        const it = items[i]
        sp.visible = !!it && !st.done
        if (!it) return
        if (sp.material.map !== texFor(it.src)) { sp.material.map = texFor(it.src); sp.material.needsUpdate = true }
        const row = items.filter((x) => x.at === it.at), n = row.length, k = row.indexOf(it)
        const a = AT[it.at]
        sp.scale.setScalar(0.55)
        sp.position.set(a.x + (k - (n - 1) / 2) * 0.55, a.h + 0.45 + (st.here === it.at ? Math.sin(t * 30) * press * 0.04 : 0), a.z + 0.15)
      })
      // 도구(손·칼·믹서기…)는 재료 위에서 누를 때마다 꾹
      tool.visible = !!st.tool
      if (st.tool) {
        if (tool.material.map !== texFor(st.tool)) { tool.material.map = texFor(st.tool); tool.material.needsUpdate = true }
        tool.scale.set(1, 1 - press * 0.15, 1)
        tool.position.set(AT.board.x + 0.9, AT.board.h + 0.75 - press * 0.1, AT.board.z + 0.5)
      }
      // 다 만든 음식은 도마 위에서 통통
      doneSp.visible = !!st.done
      if (st.done) {
        const src = `cafe/menu2/${st.done}.webp`
        if (doneSp.material.map !== texFor(src)) { doneSp.material.map = texFor(src); doneSp.material.needsUpdate = true }
        doneSp.position.set(AT.board.x, AT.board.h + 0.55 + Math.abs(Math.sin(t * 5)) * 0.2, AT.board.z + 0.7)
      }
      // 아바타·친구
      me.body.position.y = st.busy ? Math.abs(Math.sin(t * 12)) * 0.12 : 0
      s.face(me)
      helpers.forEach((d, k) => {
        const happy = st.cheer
        const wave = d.root.userData.wave as THREE.Texture | null
        if (wave) { const want = happy ? wave : (d.root.userData.stand as THREE.Texture); if (d.mat.map !== want) { d.mat.map = want; d.mat.needsUpdate = true } }
        d.body.position.y = happy ? Math.abs(Math.sin(t * 8 + k)) * 0.25 : 0
        s.face(d, k ? -1 : 1)
        d.body.rotation.z = happy ? 0 : Math.sin(t * 2 + k * 1.3) * 0.05
      })
      // 말풍선: 말하는 친구 머리 위
      const sp = helpers[st.speaker]
      const node = bubble.current
      if (node) {
        if (sp && lineRef.current) {
          const p = s.project(tmp.copy(sp.root.position).setY(sp.doll.scale.y + 0.2))
          node.style.transform = `translate(${p.x}px, ${p.y}px)`
          node.style.visibility = 'visible'
        } else node.style.visibility = 'hidden'
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
      <div ref={bubble} className="pointer-events-none absolute top-0 left-0 z-[6]" style={{ visibility: 'hidden' }}>
        {line && <p aria-live="polite" className="m-0 w-max max-w-[10rem] -translate-x-1/2 -translate-y-full rounded-2xl bg-white px-2 py-1 text-center text-[12px] leading-snug font-bold text-[#6b4b52] shadow-md">{line}</p>}
      </div>
    </div>
  )
}
