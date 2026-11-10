import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { LANE_W, LAP, LAPS, itemsBetween, type ItemKind, type Race } from '../lib/race'
import { createStage, cuteTree } from './stage3d'

/**
 * 자동차 레이스 3D 무대: 차 뒤에서 따라가며 본다. 길은 앞(-z)으로 뻗고 차는 +z 에서 -z 로 달린다.
 * 그림(public/race/)이 아직 없어서 차·아이템·길가는 임시 도형이다. 그림이 오면 이 파일의 car/itemMesh 만 그림 판으로 바꾸면 된다.
 */
const ROAD_W = LANE_W * 3 + 0.8
const TREES = 20, TREE_GAP = 11

const roadTexture = () => {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#b8b3c7'; g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#ffffff'
  for (const lx of [256 / 3, (256 * 2) / 3]) g.fillRect(lx - 3, 40, 6, 90)
  g.fillStyle = '#ff9db8'; g.fillRect(0, 0, 10, 256); g.fillRect(246, 0, 10, 256)
  g.fillStyle = '#ffffff'
  for (let y = 0; y < 256; y += 32) { g.fillRect(0, y, 10, 16); g.fillRect(246, y + 16, 10, 16) }
  return c
}

export function Race3D({ live }: { live: MutableRefObject<Race> }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const s = createStage(el, { sky: 0xbfe6ff, fog: [40, 120], shadows: false, view: { yaw: 0, pitch: 0.36, dist: 10.5, target: [0, 0.9, 0] }, fov: (w, h) => (w < h ? 66 : 48) })
    const { scene, keep, lambert } = s

    // 땅·길: 차를 따라 움직이는 판, 무늬는 반대로 밀어서 땅에 붙어 있게 한다
    const grassTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; g.fillStyle = '#bfe8a0'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d6f3bd'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32); const t = s.texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); return t })()
    const grass = new THREE.Mesh(keep(new THREE.PlaneGeometry(260, 260)), keep(new THREE.MeshBasicMaterial({ map: grassTex })))
    grass.rotation.x = -Math.PI / 2
    scene.add(grass)
    const rt = s.texOf(roadTexture())
    rt.wrapS = rt.wrapT = THREE.RepeatWrapping
    rt.repeat.set(1, 260 / ROAD_W)
    const road = new THREE.Mesh(keep(new THREE.PlaneGeometry(ROAD_W, 260)), keep(new THREE.MeshBasicMaterial({ map: rt })))
    road.rotation.x = -Math.PI / 2
    road.position.y = 0.02
    scene.add(road)

    // 바퀴 시작·끝 줄
    const lineGeo = keep(new THREE.PlaneGeometry(ROAD_W, 1.2))
    const lineTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d')!; for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#333'; g.fillRect(i * 16, 0, 16, 16); g.fillStyle = i % 2 ? '#333' : '#ffffff'; g.fillRect(i * 16, 16, 16, 16) } return s.texOf(c) })()
    const lineMat = keep(new THREE.MeshBasicMaterial({ map: lineTex }))
    for (let k = 0; k <= LAPS; k++) {
      const m = new THREE.Mesh(lineGeo, lineMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(0, 0.03, -k * LAP)
      scene.add(m)
      if (k > 0) {
        const post = keep(new THREE.BoxGeometry(0.4, 4, 0.4)), mat = lambert(0xff8fab)
        for (const sx of [-1, 1]) { const p = new THREE.Mesh(post, mat); p.position.set(sx * (ROAD_W / 2 + 0.3), 2, -k * LAP); scene.add(p) }
        const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(ROAD_W + 1, 0.8, 0.4)), lineMat)
        bar.position.set(0, 4, -k * LAP)
        scene.add(bar)
      }
    }

    // 길가 나무: 뒤로 지나가면 앞으로 옮겨 다시 쓴다
    const leafs = [0x8fd18a, 0xa5dc8f, 0xf2a9c3, 0xb9a6f0]
    const trees = Array.from({ length: TREES }, (_, i) => {
      const side = i % 2 ? 1 : -1
      const t = cuteTree(s, side * (ROAD_W / 2 + 3 + (i % 3) * 2.2), -i * TREE_GAP, 0.9 + (i % 3) * 0.2, leafs[i % leafs.length])
      return { t, k: i }
    })

    // 차: 임시 도형(몸통·바퀴·운전하는 아이 머리)
    const car = new THREE.Group()
    const body = new THREE.Mesh(keep(new THREE.BoxGeometry(1.3, 0.55, 2.0)), lambert(0xff8fb1)); body.position.y = 0.55
    const cab = new THREE.Mesh(keep(new THREE.BoxGeometry(0.95, 0.5, 0.9)), lambert(0xffc2d6)); cab.position.set(0, 1.05, 0.15)
    const head = new THREE.Mesh(keep(new THREE.SphereGeometry(0.3, 12, 10)), lambert(0xffe0c8)); head.position.set(0, 1.5, 0.15)
    const wheelGeo = keep(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 14)), wheelMat = lambert(0x4a3d52)
    const wheels = [[-0.72, 0.8], [0.72, 0.8], [-0.72, -0.7], [0.72, -0.7]].map(([wx, wz]) => { const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.32, wz); return w })
    car.add(body, cab, head, ...wheels)
    scene.add(car)
    const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 20)), keep(new THREE.MeshBasicMaterial({ color: 0x3c4a2a, transparent: true, opacity: 0.25, depthWrite: false })))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; shadow.scale.set(0.95, 1.3, 1)
    scene.add(shadow)

    // 아이템 임시 도형
    const mats: Record<ItemKind, THREE.Material> = { star: lambert(0xffd54a), boost: lambert(0xff6fa5), banana: lambert(0xffe45c), puddle: keep(new THREE.MeshBasicMaterial({ color: 0x7ec8ff, transparent: true, opacity: 0.85 })) }
    const geos: Record<ItemKind, THREE.BufferGeometry> = {
      star: keep(new THREE.OctahedronGeometry(0.5)), boost: keep(new THREE.ConeGeometry(0.45, 1.1, 10)),
      banana: keep(new THREE.TorusGeometry(0.4, 0.14, 8, 14, Math.PI * 1.3)), puddle: keep(new THREE.CircleGeometry(0.85, 20)),
    }
    const itemMesh = (kind: ItemKind) => {
      const m = new THREE.Mesh(geos[kind], mats[kind])
      if (kind === 'puddle') { m.rotation.x = -Math.PI / 2; m.position.y = 0.05 } else if (kind === 'banana') { m.rotation.x = Math.PI / 2.2; m.position.y = 0.45 } else m.position.y = 0.85
      const g = new THREE.Group(); g.add(m); g.userData.kind = kind; g.userData.m = m
      return g
    }
    const shown = new Map<number, THREE.Group>()

    let t = 0
    s.onFrame((dt) => {
      t += dt
      const r = live.current
      const cz = -r.d, cx = r.x * LANE_W
      grass.position.z = cz; road.position.z = cz - 60
      grassTex.offset.y = -cz / 6.5; rt.offset.y = -cz / ROAD_W
      // 차: 옆으로 가면 살짝 기울고, 느려질 땐 흔들, 달릴 땐 통통
      car.position.set(cx, Math.abs(Math.sin(t * 14)) * 0.04 * Math.min(1, r.speed / 20), cz)
      car.rotation.z = (r.lane - r.x) * -0.18
      car.rotation.y = (r.lane - r.x) * 0.25
      shadow.position.x = cx; shadow.position.z = cz
      if (r.slow > 0) car.rotation.y += Math.sin(t * 30) * 0.25
      wheels.forEach((w) => { w.rotation.x = (r.d * 3) % (Math.PI * 2) })
      // 카메라: 차 뒤에서 조금 옆으로 따라간다(속도가 빠를수록 살짝 멀어진다)
      s.view.target.set(cx * 0.6, 0.9, cz - 3.2)
      s.view.dist = 10.5 + Math.min(1.5, r.speed / 25) + (r.boost > 0 ? 1.2 : 0)
      // 나무
      const period = TREES * TREE_GAP
      for (const tr of trees) { const base = -tr.k * TREE_GAP; tr.t.position.z = base + period * Math.floor((cz + 25 - base) / period) }
      // 아이템
      const want = new Set<number>()
      for (const it of itemsBetween(r.d - 20, r.d + 110, r.seed)) {
        if (r.taken.includes(it.id)) continue
        want.add(it.id)
        let g = shown.get(it.id)
        if (!g) { g = itemMesh(it.kind); g.position.set(it.lane * LANE_W, 0, -it.d); scene.add(g); shown.set(it.id, g) }
        if (it.kind === 'star' || it.kind === 'boost') (g.userData.m as THREE.Mesh).rotation.y = t * 3
      }
      for (const [id, g] of shown) if (!want.has(id)) { scene.remove(g); shown.delete(id) }
    })
    return () => s.dispose()
  }, [live])
  return <div ref={host} aria-hidden className="absolute inset-0" />
}
