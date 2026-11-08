import { useEffect, useRef } from 'react'
import { animal3dAspect, animal3dUrl } from '../lib/animals3d'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { renderFigure } from '../lib/exportPng'
import { guestLook } from '../lib/guestLooks'
import { assetUrl } from '../lib/items'
import { guestAvatar } from '../lib/party'
import type { Station } from '../lib/recipes'
import type { Outfit, Tweaks } from '../lib/types'
import { clampKitchenActor, kitchenActorZone } from '../lib/kitchenZones'
import { createStage, type Doll, type Stage } from './stage3d'

/**
 * 주방 3D 무대: 냉장고·싱크대·가스레인지(냄비)·오븐·아일랜드(도마)를 3D 로 세우고, 아바타와 같이 요리하는 친구는 아일랜드 뒤에 선다.
 * 주문서 고르기·요리 단계·누르는 횟수·완성·마트는 원래 주방 그대로이고, 여기서는 그림만 그린다.
 * 자리(냉장고 등)를 누르면 onStation(자리) — 원래 주방의 같은 일을 한다. 지금 누를 곳은 반짝이고 손가락이 콕콕 가리킨다.
 */
export interface KitchenView {
  here: Station | null; shake: Station | null; step: string | null; taps: number
  board: string[]; sink: string[]; done: string | null; tool: string | null
  crew: number[]; cheer: boolean; busy: boolean; speaker: number
}
/**
 * 자리마다 받은 주방 그림(public/kitchen/3d) 한 장을 세운다. x·z 는 그림 아래 가운데(앞면) 자리, w 는 그림 너비(높이는 그림 비율대로).
 * fx 는 그림 속 자리(그림 높이에 대한 위에서부터 비율): top 은 물건 윗면(재료·도구를 올려놓는 높이), 그 밖은 효과 자리.
 */
const ART: Record<Station, { img: string; x: number; z: number; w: number; aspect: number; top: number }> = {
  fridge: { img: 'fridge', x: -3.95, z: -2.0, w: 1.7, aspect: 714 / 1400, top: 0.25 },
  sink: { img: 'sink', x: -1.6, z: -2.0, w: 2.6, aspect: 1308 / 1054, top: 0.25 },
  stove: { img: 'stove', x: 0.9, z: -2.0, w: 2.0, aspect: 953 / 1052, top: 0.3 },
  oven: { img: 'oven', x: 3.25, z: -2.0, w: 2.3, aspect: 1147 / 1055, top: 0.6 },
  // 아일랜드: 앞쪽 왼편(가운데를 비워서 아바타·친구가 다니기 좋게)
  board: { img: 'island', x: -2.6, z: 1.9, w: 4.0, aspect: 1400 / 511, top: 0.15 },
}
const hOf = (k: Station) => ART[k].w / ART[k].aspect
/** 그림 속 높이(위에서부터 비율) → 장면 높이 */
const yAt = (k: Station, fy: number) => hOf(k) * (1 - fy)
/** 아바타·친구가 다니는 곳(조리대 앞 ~ 아일랜드 뒤) */
/** 자리에서 요리할 때 아바타가 서는 곳 */
const standAt = (k: Station) => (k === 'board' ? { x: ART.board.x, z: 1.05 } : { x: ART[k].x + (ART[k].x > 0 ? -1 : 1) * ART[k].w * 0.45, z: -1.2 })

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
    const goTo = { x: ART.board.x, z: 1.05 }
    const s = createStage(el, {
      sky: 0xffeef2, orbit: true, pitchRange: [0.3, 0.75], yawRange: [-0.3, 0.3],
      view: { yaw: 0, pitch: 0.42, dist: 12, target: [0, 1.2, 0] },
      pickables: picks, onPick: (o) => tapRef.current(o.userData.station as Station),
      // 바닥을 누르면 아바타가 그곳으로 걸어간다(다니는 곳 안에서)
      onTap: (sx, sy) => { const g = s.ground(sx, sy); if (g) Object.assign(goTo, clampKitchenActor(0, g.x, g.z)) },
      fov: (w, h) => (w < h ? 66 : 46),
    })
    stage.current = s
    const { scene, keep } = s
    let oldW = 0, oldH = 0
    const fitView = () => {
      const { w, h } = s.size()
      if (w === oldW && h === oldH) return
      oldW = w; oldH = h
      const hf = 2 * Math.atan(Math.tan(s.camera.fov * Math.PI / 360) * w / h)
      s.view.dist = Math.max(10, 5.7 / Math.tan(hf / 2))
    }
    fitView()
    // 방: 나무 바닥과 창문이 있는 따뜻한 벽면
    const wood = s.texOf(assetUrl('kitchen/3d/wood.webp')); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(4, 5)
    const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(16, 20)), keep(new THREE.MeshLambertMaterial({ map: wood })))
    floor.rotation.x = -Math.PI / 2
    floor.position.z = 6 // 바닥·벽은 넉넉하게(폰 세로처럼 긴 화면에서도 위아래가 비지 않게)
    floor.receiveShadow = true
    // 그림은 10×5.625 크기로 비율을 유지한다. 벽의 남는 부분은 가장자리 색을 늘려 창문을 반복하지 않는다.
    const makeWall = (image: string, x: number, z: number, turn: number) => {
      const texture = s.texOf(assetUrl(`kitchen/3d/${image}.jpg`))
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
      texture.repeat.set(16 / 10, 14 / 5.625)
      texture.offset.set(-0.3, 0)
      const wall = new THREE.Mesh(keep(new THREE.PlaneGeometry(16, 14)), keep(new THREE.MeshLambertMaterial({ map: texture })))
      wall.position.set(x, 7, z)
      wall.rotation.y = turn
      wall.receiveShadow = true
      scene.add(wall)
    }
    scene.add(floor)
    makeWall('wall-window', 0, -3, 0)
    // 왼쪽 벽의 오른쪽 끝과 오른쪽 벽의 왼쪽 끝이 창문 쪽 모서리에 닿는다.
    makeWall('wall-left', -8, 5, Math.PI / 2)
    makeWall('wall-right', 8, 5, -Math.PI / 2)
    // 벽 선반(그림)
    const shelf = s.paperDoll(s.texOf(assetUrl('kitchen/3d/shelf.webp')), 1.45, 1400 / 401, 1, false)
    // 창문과 커튼을 가리지 않게 선반은 왼쪽 벽으로 옮긴다.
    shelf.root.position.set(-7.95, 2.9, 0)
    shelf.root.rotation.y = Math.PI / 2
    // 자리마다 그림을 세운다. 뒤에는 같은 그림을 분홍으로 물들인 판을 조금 크게 두어, 지금 누를 곳이면 반짝이게 한다
    const boxes: Partial<Record<Station, { doll: Doll; glow: THREE.Mesh; glowMat: THREE.MeshBasicMaterial }>> = {}
    for (const k of Object.keys(ART) as Station[]) {
      const a = ART[k], tex = s.texOf(assetUrl(`kitchen/3d/${a.img}.webp`))
      const d = s.paperDoll(tex, hOf(k), a.aspect, 1, k !== 'board')
      d.root.position.set(a.x, 0, a.z)
      d.root.userData.station = k
      const glowMat = keep(new THREE.MeshBasicMaterial({ map: tex, color: 0xff5f8f, transparent: true, opacity: 0, depthWrite: false }))
      const glow = new THREE.Mesh(d.doll.geometry, glowMat)
      glow.scale.set(d.doll.scale.x * 1.05, d.doll.scale.y * 1.04, 1)
      glow.position.set(0, -hOf(k) * 0.02, -0.02)
      d.body.add(glow)
      picks.push(d.root)
      boxes[k] = { doll: d, glow, glowMat }
    }
    // 아바타(아일랜드 뒤 가운데)와 같이 요리하는 친구(양옆)
    const me = s.paperDoll(null, 2.6, 1024 / 1536, 1504 / 1536, false)
    me.root.position.set(ART.board.x, 0, 1.05)
    const meGo = goTo
    let meDir: 1 | -1 = 1, lastHere: Station | null = null
    meRef.current = me
    const helpers: Doll[] = []
    let crewKey = ''
    const buildCrew = (crew: number[]) => {
      for (const d of helpers) scene.remove(d.root)
      helpers.length = 0
      crew.forEach((g, k) => {
        const av = guestAvatar(g)
        const d = av ? s.paperDoll(null, 2.6, 1024 / 1536, 1504 / 1536, false) : s.paperDoll(s.texOf(animal3dUrl(CALL_ANIMALS[g].img)), 1.7, animal3dAspect(CALL_ANIMALS[g].img), 1, false)
        if (av) renderFigure(guestLook(av.id), {}, av).then((cv) => s.setMap(d, s.texOf(cv))).catch(() => {})
        const zone = kitchenActorZone(k + 1)
        const startX = (zone.x0 + zone.x1) / 2
        d.root.position.set(startX, 0, 0.6)
        d.root.userData.go = { x: startX, z: 0.6, wait: 1 + k, dir: (k ? -1 : 1) as 1 | -1 }
        d.root.userData.wave = null // 3D 동물 그림은 한 장(기쁠 때는 통통 뛴다)
        d.root.userData.stand = d.mat.map
        helpers.push(d)
      })
    }
    // 효과 그림
    const sprite = (src: string, size: number) => { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: s.texOf(assetUrl(src)), depthTest: false }))); sp.scale.setScalar(size); sp.renderOrder = 5; sp.visible = false; scene.add(sp); return sp }
    const point = sprite('kitchen/point.webp', 0.4)
    const flames = [0, 1, 2].map(() => sprite('kitchen/fire.webp', 0.26))
    const drops = [0, 1].map(() => sprite('kitchen/drop.svg', 0.14))
    const ice = sprite('kitchen/ice.webp', 0.42)
    const texCache = new Map<string, THREE.Texture>()
    const texFor = (src: string) => { if (!texCache.has(src)) texCache.set(src, s.texOf(assetUrl(src))); return texCache.get(src)! }
    const pool: THREE.Sprite[] = []
    const tool = new THREE.Sprite(keep(new THREE.SpriteMaterial({ depthTest: false }))); tool.renderOrder = 6; tool.visible = false; scene.add(tool)
    const doneSp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ depthTest: false }))); doneSp.renderOrder = 6; doneSp.visible = false; doneSp.scale.setScalar(0.48); scene.add(doneSp)
    const top = (k: Station) => new THREE.Vector3(ART[k].x, hOf(k) + 0.15, ART[k].z)

    let t = 0
    const tmp = new THREE.Vector3()
    let lastTaps = 0, press = 0
    s.onFrame((dt) => {
      t += dt
      fitView()
      const st = v.current
      const key = st.crew.join()
      if (key !== crewKey) { crewKey = key; buildCrew(st.crew) }
      if (st.taps !== lastTaps) { lastTaps = st.taps; press = 1 }
      press = Math.max(0, press - dt * 5)
      // 지금 누를 곳: 반짝이고 손가락이 위에서 콕콕. 틀린 곳을 누르면 그 자리가 흔들린다
      for (const k of Object.keys(boxes) as Station[]) {
        const b = boxes[k]!
        b.glowMat.opacity = st.here === k ? 0.35 + Math.sin(t * 6) * 0.25 : 0
        b.doll.root.position.x = ART[k].x + (st.shake === k ? Math.sin(t * 50) * 0.06 : 0)
        b.doll.body.scale.y = st.here === k ? 1 - press * 0.03 : 1
      }
      point.visible = !!st.here
      if (st.here) point.position.copy(top(st.here)).add(tmp.set(0, 0.38 + Math.abs(Math.sin(t * 5)) * 0.1, 0))
      // 불꽃: 끓이기·녹이기는 냄비 밑, 굽기는 오븐 창
      const fire = st.step === 'boil' || st.step === 'melt' ? 'stove' : st.step === 'bake' ? 'oven' : null
      flames.forEach((f, i) => {
        f.visible = !!fire
        if (!fire) return
        const a = ART[fire]
        f.position.set(a.x + (i - 1) * (fire === 'oven' ? 0.35 : 0.3), fire === 'oven' ? yAt('oven', 0.66) : yAt('stove', 0.33), a.z + 0.05)
        f.scale.setScalar((fire === 'oven' ? 0.25 : 0.22) * (1 + 0.1 * Math.sin(t * 12 + i)) * (1 + st.taps * 0.05))
      })
      // 씻기: 물방울이 떨어진다, 굳히기: 냉장고에 얼음
      drops.forEach((d, i) => {
        d.visible = st.step === 'wash'
        const y = ((t * 1.6 + i * 0.5) % 1)
        d.position.set(ART.sink.x, yAt('sink', 0.1) - y * (yAt('sink', 0.1) - yAt('sink', 0.27)), ART.sink.z + 0.05)
      })
      ice.visible = st.step === 'chill'
      ice.position.set(ART.fridge.x, yAt('fridge', 0.25), ART.fridge.z + 0.1)
      // 재료: 도마 위에 줄지어, 씻는 재료는 싱크대 안
      const items = [...st.board.map((src) => ({ src, at: 'board' as const })), ...st.sink.map((src) => ({ src, at: 'sink' as const }))]
      while (pool.length < items.length) { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ depthTest: false }))); sp.renderOrder = 5; scene.add(sp); pool.push(sp) }
      pool.forEach((sp, i) => {
        const it = items[i]
        sp.visible = !!it && !st.done
        if (!it) return
        if (sp.material.map !== texFor(it.src)) { sp.material.map = texFor(it.src); sp.material.needsUpdate = true }
        const row = items.filter((x) => x.at === it.at), n = row.length, k = row.indexOf(it)
        const a = ART[it.at]
        sp.scale.setScalar(0.3)
        sp.position.set(a.x + (k - (n - 1) / 2) * 0.34, yAt(it.at, a.top) + 0.25 + (st.here === it.at ? Math.sin(t * 30) * press * 0.04 : 0), a.z + 0.1)
      })
      // 도구(손·칼·믹서기…)는 재료 위에서 누를 때마다 꾹
      tool.visible = !!st.tool
      if (st.tool) {
        if (tool.material.map !== texFor(st.tool)) { tool.material.map = texFor(st.tool); tool.material.needsUpdate = true }
        tool.scale.set(0.48, 0.48 * (1 - press * 0.15), 1)
        tool.position.set(ART.board.x + 0.9, yAt('board', ART.board.top) + 0.32 - press * 0.06, ART.board.z + 0.1)
      }
      // 다 만든 음식은 도마 위에서 통통
      doneSp.visible = !!st.done
      if (st.done) {
        const src = `cafe/menu2/${st.done}.webp`
        if (doneSp.material.map !== texFor(src)) { doneSp.material.map = texFor(src); doneSp.material.needsUpdate = true }
        doneSp.position.set(ART.board.x, yAt('board', ART.board.top) + 0.25 + Math.abs(Math.sin(t * 5)) * 0.06, ART.board.z + 0.1)
      }
      // 아바타·친구
      // 아바타: 지금 할 자리로 걸어가서 선다(도마는 아일랜드 뒤). 바닥을 누르면 그곳으로 간다
      if (st.here && st.here !== lastHere) Object.assign(meGo, clampKitchenActor(0, standAt(st.here).x, standAt(st.here).z))
      lastHere = st.here
      const mp = me.root.position, mdx = meGo.x - mp.x, mdz = meGo.z - mp.z, md = Math.hypot(mdx, mdz)
      const meWalk = md > 0.04
      if (meWalk) { const k = Math.min(md, dt * 3.2); mp.x += (mdx / md) * k; mp.z += (mdz / md) * k; if (Math.abs(mdx) > 0.02) meDir = mdx > 0 ? 1 : -1 }
      me.body.position.y = st.busy || meWalk ? Math.abs(Math.sin(t * (meWalk ? 9 : 12))) * (meWalk ? 0.1 : 0.12) : 0
      s.face(me, meDir)
      helpers.forEach((d, k) => {
        const happy = st.cheer
        const wave = d.root.userData.wave as THREE.Texture | null
        if (wave) { const want = happy ? wave : (d.root.userData.stand as THREE.Texture); if (d.mat.map !== want) { d.mat.map = want; d.mat.needsUpdate = true } }
        // 친구: 조리대 앞을 거닐다 쉬었다 한다(아바타·다른 친구와 부딪히지 않게). 다 만들면 그 자리에서 폴짝
        const zone = kitchenActorZone(k + 1)
        const go = d.root.userData.go as { x: number; z: number; wait: number; dir: 1 | -1 }, p = d.root.position
        let walk = false
        if (!happy) {
          go.wait -= dt
          const dx = go.x - p.x, dz = go.z - p.z, dd = Math.hypot(dx, dz)
          if (dd > 0.05 && go.wait <= 0) { const sp = Math.min(dd, dt * 1.6); p.x += (dx / dd) * sp; p.z += (dz / dd) * sp; if (Math.abs(dx) > 0.02) go.dir = dx > 0 ? 1 : -1; walk = true }
          else if (go.wait <= 0) {
            go.wait = 1.5 + Math.random() * 3
            go.x = zone.x0 + Math.random() * (zone.x1 - zone.x0); go.z = zone.z0 + Math.random() * (zone.z1 - zone.z0)
          }
        }
        for (const o of [mp, ...helpers.filter((x) => x !== d).map((x) => x.root.position)]) {
          const ax = p.x - o.x, az = p.z - o.z, ad = Math.hypot(ax, az)
          if (ad < 1.1 && ad > 1e-3) { p.x = o.x + (ax / ad) * 1.1; p.z = o.z + (az / ad) * 1.1 }
        }
        Object.assign(p, clampKitchenActor(k + 1, p.x, p.z))
        d.body.position.y = happy ? Math.abs(Math.sin(t * 8 + k)) * 0.25 : walk ? Math.abs(Math.sin(t * 8 + k)) * 0.08 : 0
        s.face(d, go.dir)
        d.body.rotation.z = happy || walk ? 0 : Math.sin(t * 2 + k * 1.3) * 0.05
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
