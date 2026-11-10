import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { LANE_W, LAP, LAPS, itemsBetween, type ItemKind, type Race } from '../lib/race'
import { assetUrl } from '../lib/items'
import { createStage } from './stage3d'

/**
 * 자동차 레이스 3D 무대: 차 뒤에서 따라가며 본다. 길은 앞(-z)으로 뻗고 차는 +z 에서 -z 로 달린다.
 * 부스터·바나나·반짝이·먼지는 public/race/ 그림, 아직 그림이 없는 차·별·물웅덩이·길가는 임시 도형이다(그림이 오면 car/itemMesh 만 바꾸면 된다).
 */
/** 길(연석 포함) 너비: 아스팔트가 세 칸(LANE_W*3)이 되도록 그림 비율(410/560)에 맞춘다 */
const ROAD_W = LANE_W * 3 * (560 / 410)
/** 길 그림 한 장이 덮는 길이(그림 비율 유지) */
const ROAD_TILE = ROAD_W * (951 / 512)
const GROUND_TILE = 10
const PROPS = 20, PROP_GAP = 11

export type RaceTheme = 'meadow' | 'snow' | 'candy'
/** 장소마다 하늘색(하늘 그림 아래·안개), 길가 소품 */
const THEMES: Record<RaceTheme, { sky: number; prop: 'tree' | 'lollipop' | null }> = {
  meadow: { sky: 0xc9ecff, prop: 'tree' },
  snow: { sky: 0xdad6f6, prop: null },
  candy: { sky: 0xffc9e3, prop: 'lollipop' },
}

export function Race3D({ live, theme }: { live: MutableRefObject<Race>; theme: RaceTheme }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const th = THEMES[theme]
    const s = createStage(el, { sky: th.sky, fog: [60, 170], shadows: false, view: { yaw: 0, pitch: 0.36, dist: 10.5, target: [0, 0.9, 0] }, fov: (w, h) => (w < h ? 66 : 48) })
    const { scene, keep, lambert } = s
    s.camera.far = 600
    s.camera.updateProjectionMatrix()
    const art = (name: string) => s.texOf(assetUrl(`race/${name}.webp`))
    const rep = (t: THREE.Texture) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t }

    // 먼 하늘: 하늘 그림을 멀리 세워 두고 늘 카메라를 따라온다(언덕 아랫단이 땅 끝과 만나게)
    const skyTex = art(`sky_${theme}`)
    const SKY_H = 110, SKY_Z = 230
    const sky = new THREE.Mesh(keep(new THREE.PlaneGeometry(SKY_H * 3, SKY_H)), keep(new THREE.MeshBasicMaterial({ map: skyTex, fog: false, depthWrite: false })))
    sky.position.y = SKY_H * 0.25 + 1
    sky.renderOrder = -1
    scene.add(sky)

    // 땅·길: 차를 따라 움직이는 판, 무늬는 반대로 밀어서 땅에 붙어 있게 한다
    const gTex = rep(art(`ground_${theme}`))
    gTex.repeat.set(500 / GROUND_TILE, 500 / GROUND_TILE)
    const grass = new THREE.Mesh(keep(new THREE.PlaneGeometry(500, 500)), keep(new THREE.MeshBasicMaterial({ map: gTex })))
    grass.rotation.x = -Math.PI / 2
    scene.add(grass)
    const rt = rep(art(`road_${theme}`))
    rt.repeat.set(1, 260 / ROAD_TILE)
    const road = new THREE.Mesh(keep(new THREE.PlaneGeometry(ROAD_W, 260)), keep(new THREE.MeshBasicMaterial({ map: rt })))
    road.rotation.x = -Math.PI / 2
    road.position.y = 0.02
    scene.add(road)

    // 바퀴 시작·끝 줄(땅에 깐 체크무늬)과 결승 아치(세워 둔 그림, 가운데는 비어 있어서 차가 지나간다)
    const lineTex = art('startline'), archTex = art('arch')
    const lineW = LANE_W * 3 + 0.6
    const lineGeo = keep(new THREE.PlaneGeometry(lineW, lineW * (115 / 768)))
    const lineMat = keep(new THREE.MeshBasicMaterial({ map: lineTex, transparent: true, depthWrite: false }))
    const ARCH_W = ROAD_W + 4.5
    const archGeo = keep(new THREE.PlaneGeometry(ARCH_W, ARCH_W * (574 / 768)))
    const archMat = keep(new THREE.MeshBasicMaterial({ map: archTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }))
    for (let k = 0; k <= LAPS; k++) {
      const m = new THREE.Mesh(lineGeo, lineMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(0, 0.04, -k * LAP)
      m.renderOrder = 1
      scene.add(m)
      const arch = new THREE.Mesh(archGeo, archMat)
      arch.position.set(0, ARCH_W * (574 / 768) / 2 - 0.2, -k * LAP - (k === 0 ? 12 : 0))
      scene.add(arch)
    }

    // 길가: 장소마다 다른 나무(뒤로 지나가면 앞으로 옮겨 다시 쓴다) + 응원하는 곰 + 표지판
    const sideX = ROAD_W / 2 + 3
    const spriteOf = (tex: THREE.Texture, w: number, h: number, y: number) => { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))); sp.scale.set(w, h, 1); sp.position.y = y; return sp }
    const pineTrunk = keep(new THREE.CylinderGeometry(0.22, 0.3, 1.2, 8)), pineTrunkMat = keep(new THREE.MeshBasicMaterial({ color: 0xa88a6a }))
    const pineCone = keep(new THREE.ConeGeometry(1, 1, 12)), pineMats = [0xdcebff, 0xeaf3ff, 0xf7fbff].map((c) => keep(new THREE.MeshBasicMaterial({ color: c })))
    const props = Array.from({ length: PROPS }, (_, i) => {
      const side = i % 2 ? 1 : -1, x = side * (sideX + (i % 3) * 2.2), z = -i * PROP_GAP
      if (th.prop) {
        const big = 0.9 + (i % 3) * 0.2
        const o = th.prop === 'tree' ? spriteOf(art('prop_tree'), 4.6 * big, 4.2 * big, 2.1 * big) : spriteOf(art('prop_lollipop'), 3.1 * big, 4.8 * big, 2.4 * big)
        o.position.x = x; o.position.z = z; scene.add(o)
        return { o, k: i }
      }
      // 그림이 없는 눈 나라: 눈 덮인 소나무(뿔 세 개를 쌓는다. 그림자 없이 밝게)
      const o = new THREE.Group(), sc = 0.9 + (i % 3) * 0.2
      const trunk = new THREE.Mesh(pineTrunk, pineTrunkMat); trunk.position.y = 0.5; o.add(trunk)
      ;[[1.9, 1.5, 2.2], [1.5, 1.3, 3.3], [1.1, 1.1, 4.3]].forEach(([r, h, y], j) => { const c = new THREE.Mesh(pineCone, pineMats[j]); c.scale.set(r, h, r); c.position.y = y - 0.2; o.add(c) })
      o.position.set(x, 0, z); o.scale.setScalar(sc); scene.add(o)
      return { o, k: i }
    })
    const BEARS = 8, BEAR_GAP = 62
    const bearTex = art('prop_bear'), signTex = art('prop_sign')
    const bears = Array.from({ length: BEARS }, (_, i) => {
      const o = spriteOf(bearTex, 2.6, 2.5, 1.25)
      o.position.set((i % 2 ? 1 : -1) * (ROAD_W / 2 + 1.6), 1.25, -30 - i * BEAR_GAP)
      scene.add(o)
      return { o, k: i }
    })
    for (let k = 0; k <= LAPS; k++) { const o = spriteOf(signTex, 2.3, 2.1, 1.05); o.position.set(-(ROAD_W / 2 + 1.5), 1.05, -k * LAP - 4); scene.add(o) }

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
    const mats = { star: lambert(0xffd54a), puddle: keep(new THREE.MeshBasicMaterial({ color: 0x7ec8ff, transparent: true, opacity: 0.85 })) }
    const geos = { star: keep(new THREE.OctahedronGeometry(0.5)), puddle: keep(new THREE.CircleGeometry(0.85, 20)) }
    // 그림 판(항상 카메라를 본다): 부스터 로켓·바나나
    const boostTex = art('item_boost'), bananaTex = art('item_banana')
    const itemMesh = (kind: ItemKind) => {
      if (kind === 'boost' || kind === 'banana') {
        const g = new THREE.Group(), sp = kind === 'boost' ? spriteOf(boostTex, 1.3, 1.65, 1.0) : spriteOf(bananaTex, 1.6, 1.1, 0.6)
        g.add(sp); g.userData.kind = kind; g.userData.m = sp
        return g
      }
      const m = new THREE.Mesh(geos[kind as 'star' | 'puddle'], mats[kind as 'star' | 'puddle'])
      if (kind === 'puddle') { m.rotation.x = -Math.PI / 2; m.position.y = 0.05 } else m.position.y = 0.85
      const g = new THREE.Group(); g.add(m); g.userData.kind = kind; g.userData.m = m
      return g
    }
    const shown = new Map<number, THREE.Group>()

    // 효과: 별·부스터를 먹으면 반짝이, 미끄러지면 먼지, 부스터 중에는 불꽃(차 뒤)
    const sparkleSp = spriteOf(art('fx_sparkle'), 2.6, 2.0, 1.6), dustSp = spriteOf(art('fx_dust'), 2.4, 1.5, 0.9)
    sparkleSp.visible = dustSp.visible = false
    scene.add(sparkleSp, dustSp)

    let t = 0
    s.onFrame((dt) => {
      t += dt
      const r = live.current
      const cz = -r.d, cx = r.x * LANE_W
      grass.position.z = cz; grass.position.x = cx * 0; road.position.z = cz - 60
      gTex.offset.y = -cz / GROUND_TILE; rt.offset.y = -cz / ROAD_TILE
      sky.position.x = cx * 0.6; sky.position.z = cz - SKY_Z
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
      sparkleSp.visible = r.sparkle > 0; sparkleSp.position.set(cx, 1.7 + (0.6 - r.sparkle) * 0.8, cz - 0.5)
      dustSp.visible = r.dust > 0; dustSp.position.set(cx, 1.0, cz - 0.3); dustSp.scale.setScalar(1 + (0.7 - r.dust) * 1.2)
      // 나무
      const period = PROPS * PROP_GAP
      for (const tr of props) { const base = -tr.k * PROP_GAP; tr.o.position.z = base + period * Math.floor((cz + 25 - base) / period) }
      const bp = BEARS * BEAR_GAP
      for (const b of bears) { const base = -30 - b.k * BEAR_GAP; b.o.position.z = base + bp * Math.floor((cz + 25 - base) / bp) }
      // 아이템
      const want = new Set<number>()
      for (const it of itemsBetween(r.d - 20, r.d + 110, r.seed)) {
        if (r.taken.includes(it.id)) continue
        want.add(it.id)
        let g = shown.get(it.id)
        if (!g) { g = itemMesh(it.kind); g.position.set(it.lane * LANE_W, 0, -it.d); scene.add(g); shown.set(it.id, g) }
        if (it.kind === 'star') (g.userData.m as THREE.Mesh).rotation.y = t * 3
        else if (it.kind === 'boost') (g.userData.m as THREE.Sprite).position.y = 1.0 + Math.sin(t * 4 + it.id) * 0.12
      }
      for (const [id, g] of shown) if (!want.has(id)) { scene.remove(g); shown.delete(id) }
    })
    return () => s.dispose()
  }, [live, theme])
  return <div ref={host} aria-hidden className="absolute inset-0" />
}
