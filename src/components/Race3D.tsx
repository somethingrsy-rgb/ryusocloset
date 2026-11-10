import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { LANE_W, LAP, LAPS, itemsBetween, type ItemKind, type Race } from '../lib/race'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { animal3dAspect, animal3dUrl } from '../lib/animals3d'
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
export type RaceCar = 'heart' | 'cloud' | 'pumpkin' | 'bunny' | 'star'
/** 자동차 그림 크기(픽셀): 같은 눈금으로 줄여서 똑바로·왼쪽·오른쪽 크기가 서로 맞는다. 1픽셀 = CAR_K 장면 단위 */
const CAR_PX: Record<RaceCar, Record<'straight' | 'left' | 'right', [number, number]>> = {
  heart: { straight: [457, 414], left: [512, 408], right: [485, 379] },
  cloud: { straight: [477, 369], left: [492, 392], right: [504, 403] },
  pumpkin: { straight: [418, 525], left: [482, 537], right: [482, 537] },
  bunny: { straight: [434, 538], left: [498, 538], right: [491, 535] },
  star: { straight: [493, 430], left: [532, 374], right: [532, 374] },
}
const CAR_K = 4.3 / 457
/** 친구 차로 쓰는 차 그림들(내 차는 빼고 돌려 쓴다) */
export const ALL_CARS: RaceCar[] = ['heart', 'cloud', 'pumpkin', 'bunny', 'star']
/** 운전석 자리(차 그림 높이 대비, 바닥에서부터): 이 자리에 운전하는 얼굴이 앉는다 */
const SEAT: Record<RaceCar, number> = { heart: 0.56, cloud: 0.6, pumpkin: 0.5, bunny: 0.5, star: 0.58 }
/** 장소마다 하늘색(하늘 그림 아래·안개), 길가 소품 */
const THEMES: Record<RaceTheme, { sky: number; prop: 'tree' | 'lollipop' | 'xmas' }> = {
  meadow: { sky: 0xc9ecff, prop: 'tree' },
  snow: { sky: 0xdad6f6, prop: 'xmas' },
  candy: { sky: 0xffc9e3, prop: 'lollipop' },
}

export function Race3D({ live, theme, car: carId }: { live: MutableRefObject<Race>; theme: RaceTheme; car: RaceCar }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const th = THEMES[theme]
    const s = createStage(el, { sky: th.sky, fog: [60, 170], shadows: false, view: { yaw: 0, pitch: 0.36, dist: 10.5, target: [0, 0.9, 0] }, fov: (w, h) => (w < h ? 66 : 48) })
    const { scene, keep } = s
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
    const lineGeo = keep(new THREE.PlaneGeometry(lineW, lineW * (115 / 768) * 1.8))
    const lineMat = keep(new THREE.MeshBasicMaterial({ map: lineTex, transparent: true, depthWrite: false }))
    const ARCH_W = ROAD_W + 4.5
    const archGeo = keep(new THREE.PlaneGeometry(ARCH_W, ARCH_W * (574 / 768)))
    const archMat = keep(new THREE.MeshBasicMaterial({ map: archTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }))
    // 출발 문은 차 앞 14칸에 한 번만(차가 선 위에서 시작하면 선이 차에 가려 겹쳐 보였다). 바퀴·결승 문은 거리 그대로
    const gateZ = (k: number) => (k === 0 ? -14 : -k * LAP)
    for (let k = 0; k <= LAPS; k++) {
      const m = new THREE.Mesh(lineGeo, lineMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(0, 0.04, gateZ(k))
      m.renderOrder = 1
      scene.add(m)
      const arch = new THREE.Mesh(archGeo, archMat)
      arch.position.set(0, ARCH_W * (574 / 768) / 2 - 0.2, gateZ(k))
      scene.add(arch)
    }

    // 길가: 장소마다 다른 나무(뒤로 지나가면 앞으로 옮겨 다시 쓴다) + 응원하는 곰 + 표지판
    const sideX = ROAD_W / 2 + 3
    const spriteOf = (tex: THREE.Texture, w: number, h: number, y: number) => { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))); sp.scale.set(w, h, 1); sp.position.y = y; return sp }
    // [그림 이름, 높이, 가로세로 비율] — 높이 대비 폭은 spriteOf(w, h) 순서에 맞춰 아래에서 곱한다
    const CANDY_BIG: [string, number, number][] = [['cd_cotton_pink', 4.4, 0.85], ['cd_lolli_a', 4.4, 0.74], ['cd_cotton_blue', 4.4, 0.81], ['prop_lollipop', 4.8, 0.65], ['cd_lolli_b', 4.4, 0.74]]
    const SNOW_BIG: [string, number, number][] = [['prop_xmas', 4.7, 0.72], ['sn_pine', 4.0, 1.03], ['sn_pinelit', 4.0, 1.01], ['prop_xmas', 4.7, 0.72], ['sn_bare', 4.0, 1.07]]
    const props = Array.from({ length: PROPS }, (_, i) => {
      const side = i % 2 ? 1 : -1, x = side * (sideX + (i % 3) * 2.2), z = -i * PROP_GAP
      const big = 0.9 + (i % 3) * 0.2
      const o = th.prop === 'tree' ? (i % 4 === 1 ? spriteOf(art('prop_tree2'), 4.7 * big, 4.4 * big, 2.2 * big) : spriteOf(art('prop_tree'), 4.6 * big, 4.2 * big, 2.1 * big))
        : th.prop === 'xmas' ? (() => { const [img, h, asp] = SNOW_BIG[i % SNOW_BIG.length]; return spriteOf(art(img), h * big * asp, h * big, h * big / 2) })() : (() => { const [img, h, asp] = CANDY_BIG[i % CANDY_BIG.length]; return spriteOf(art(img), h * big * asp, h * big, h * big / 2) })()
      o.position.x = x; o.position.z = z; scene.add(o)
      return { o, k: i }
    })
    // 길가 구경거리: 그림마다 쓰는 곳이 정해져 있다(초원: 토끼·꽃무더기 / 사탕 나라: 곰·풍선·사탕 나라 모음 / 눈 나라: 눈 나라 모음·크리스마스 나무)
    // [그림 이름, 높이, 가로세로 비율]
    type Art = [string, number, number]
    const meadow = theme === 'meadow', candy = theme === 'candy', snow = theme === 'snow'
    const CHEER: Art[] = meadow ? [['prop_bunny', 3.0, 0.83]] : candy ? [
      ['prop_bear', 2.6, 1.04], ['cd_castle', 4.6, 0.92], ['prop_balloons', 3.2, 0.68], ['cd_lamp_a', 3.8, 0.54], ['cd_cakehouse', 3.6, 0.93], ['cd_cart', 2.8, 0.94],
      ['cd_ginger', 3.2, 1.0], ['cd_lamp_b', 3.8, 0.51], ['cd_fountain', 2.8, 1.05], ['prop_lamp', 3.8, 0.44], ['cd_umbrella', 2.6, 1.09], ['cd_cupcake', 2.4, 0.86],
      ['cd_bench', 1.9, 1.32], ['cd_sign', 2.6, 0.93], ['cd_fence', 1.6, 1.77], ['prop_balloons', 3.2, 0.68],
    ] : snow ? [
      ['sn_snowman', 3.0, 1.06], ['sn_igloo', 3.0, 1.36], ['sn_lamp', 3.8, 0.64], ['sn_castle', 4.6, 1.2], ['sn_bunnyman', 2.4, 0.97], ['sn_fountain', 2.8, 1.21],
      ['sn_sign', 2.8, 0.92], ['sn_sled', 1.8, 1.36], ['sn_snowman', 3.0, 1.06], ['sn_gifts', 2.2, 1.23], ['sn_bench', 1.9, 1.56], ['sn_fence', 1.5, 1.95],
    ] : []
    const signTex = art('prop_sign')
    const CHEERS = CHEER.length ? 12 : 0, CHEER_GAP = 40
    const cheers = Array.from({ length: CHEERS }, (_, i) => {
      const [img, h, asp] = CHEER[i % CHEER.length]
      const o = spriteOf(art(img), h * asp, h, h / 2)
      o.position.set((i % 2 ? 1 : -1) * (ROAD_W / 2 + 1.7), h / 2, -30 - i * CHEER_GAP)
      scene.add(o)
      return { o, k: i }
    })
    const GROUND: Art[] = meadow ? [['prop_flowers', 1.1, 1.55]] : candy ? [
      ['cd_bush', 1.2, 1.52], ['cd_gummy', 1.0, 1.5], ['cd_candy', 0.9, 1.5], ['cd_peppermint', 1.0, 1.03], ['cd_jelly', 1.1, 0.98], ['cd_gummybear', 1.3, 0.81],
      ['cd_heartcookie', 1.0, 1.08], ['cd_starface', 1.1, 0.99],
    ] : snow ? [
      ['sn_rock', 1.3, 1.59], ['sn_holly', 1.3, 1.35], ['sn_iceplant', 1.5, 1.15], ['sn_crystal', 1.4, 1.15], ['sn_flake', 1.2, 0.96], ['sn_gifts', 1.2, 1.23],
    ] : []
    const FLOWERS = GROUND.length ? 14 : 0, FLOWER_GAP = 17
    const flowers = Array.from({ length: FLOWERS }, (_, i) => {
      const [img, h, asp] = GROUND[i % GROUND.length]
      const o = spriteOf(art(img), h * asp, h, h / 2)
      o.position.set((i % 2 ? 1 : -1) * (ROAD_W / 2 + 0.9 + (i % 3) * 0.5), h / 2, -8 - i * FLOWER_GAP)
      scene.add(o)
      return { o, k: i }
    })
    for (let k = 0; k <= LAPS; k++) { const o = spriteOf(signTex, 2.3, 2.1, 1.05); o.position.set(-(ROAD_W / 2 + 1.5), 1.05, gateZ(k) + 9); scene.add(o) }

    // 차: 그림 판 세 장(똑바로·왼쪽·오른쪽)을 겹쳐 두고, 옆으로 움직이는 속도에 따라 서서히 섞는다(뚝 바뀌지 않고 미끄러지듯)
    const buildCar = (id: RaceCar, k = 1) => {
      const group = new THREE.Group()
      const sp = (['straight', 'left', 'right'] as const).map((v) => {
        const [pw, ph] = CAR_PX[id][v]
        const m = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: art(`car_${id}_${v}`), transparent: true, depthWrite: false })))
        m.center.set(0.5, 0.05); m.scale.set(pw * CAR_K * k, ph * CAR_K * k, 1)
        group.add(m); return m
      })
      scene.add(group)
      return { group, sp, h: CAR_PX[id].straight[1] * CAR_K * k }
    }
    const lean = (c: ReturnType<typeof buildCar>, vx: number, slip: number, fade = 1) => {
      const l = Math.max(-1, Math.min(1, vx / 2.2))
      c.sp[0].material.opacity = (1 - Math.abs(l) * 0.9) * fade
      c.sp[1].material.opacity = (l < 0 ? -l : 0) * fade; c.sp[2].material.opacity = (l > 0 ? l : 0) * fade
      c.sp.forEach((m) => { m.material.rotation = slip + l * -0.07 })
    }
    const mine = buildCar(carId)
    const car = mine.group
    // 컴퓨터 친구 차: 내 차가 아닌 차들을 돌려 쓰고, 동물 친구가 운전한다
    const others = ALL_CARS.filter((c) => c !== carId)
    const rivalCars = live.current.rivals.map((rv, i) => {
      const id = others[i % others.length], c = buildCar(id, 0.92)
      const img = CALL_ANIMALS[rv.animal % CALL_ANIMALS.length].img
      const a = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: s.texOf(animal3dUrl(img)), transparent: true, depthWrite: false })))
      const ah = c.h * 0.42; a.scale.set(ah * animal3dAspect(img), ah, 1); a.position.set(0, c.h * SEAT[id], 0.3)
      c.group.add(a)
      return c
    })
    const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 20)), keep(new THREE.MeshBasicMaterial({ color: 0x3c4a2a, transparent: true, opacity: 0.25, depthWrite: false })))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; shadow.scale.set(1.8, 2.0, 1)
    scene.add(shadow)

    // 아이템 임시 도형
    const mats = { puddle: keep(new THREE.MeshBasicMaterial({ color: 0x7ec8ff, transparent: true, opacity: 0.85 })) }
    const geos = { puddle: keep(new THREE.CircleGeometry(0.85, 20)) }
    // 그림 판(항상 카메라를 본다): 부스터 로켓·바나나
    const boostTex = art('item_boost'), bananaTex = art('item_banana'), starTex = art('item_star')
    const itemMesh = (kind: ItemKind) => {
      if (kind === 'boost' || kind === 'banana' || kind === 'star') {
        const g = new THREE.Group(), sp = kind === 'boost' ? spriteOf(boostTex, 1.3, 1.65, 1.0) : kind === 'star' ? spriteOf(starTex, 1.0, 1.0, 0.9) : spriteOf(bananaTex, 1.6, 1.1, 0.6)
        g.add(sp); g.userData.kind = kind; g.userData.m = sp
        return g
      }
      const m = new THREE.Mesh(geos.puddle, mats.puddle)
      m.rotation.x = -Math.PI / 2; m.position.y = 0.05
      const g = new THREE.Group(); g.add(m); g.userData.kind = kind; g.userData.m = m
      return g
    }
    const shown = new Map<number, THREE.Group>()

    // 효과: 별·부스터를 먹으면 반짝이, 미끄러지면 먼지, 부스터 중에는 불꽃(차 뒤)
    const sparkleSp = spriteOf(art('fx_sparkle'), 2.6, 2.0, 1.6), dustSp = spriteOf(art('fx_dust'), 2.4, 1.5, 0.9)
    sparkleSp.visible = dustSp.visible = false
    scene.add(sparkleSp, dustSp)

    let t = 0, camX = 0
    s.onFrame((dt) => {
      t += dt
      const r = live.current
      const cz = -r.d, cx = r.x * LANE_W
      grass.position.z = cz; grass.position.x = cx * 0; road.position.z = cz - 60
      gTex.offset.y = -cz / GROUND_TILE; rt.offset.y = -cz / ROAD_TILE
      sky.position.x = cx * 0.6; sky.position.z = cz - SKY_Z
      // 차: 옆 칸으로 가는 동안은 그쪽 그림, 달릴 땐 통통, 미끄러지면 빙글 흔들
      car.position.set(cx, Math.abs(Math.sin(t * 14)) * 0.05 * Math.min(1, r.speed / 20), cz)
      lean(mine, r.vx, r.slow > 0 ? Math.sin(t * 30) * 0.22 : 0)
      r.rivals.forEach((rv, i) => {
        const c = rivalCars[i]
        c.group.position.set(rv.x * LANE_W, Math.abs(Math.sin(t * 14 + i)) * 0.05 * Math.min(1, rv.speed / 20), -rv.d)
        // 내 차 뒤로 처진 친구는 카메라 앞을 가리지 않게 서서히 사라진다
        const fade = Math.max(0, Math.min(1, (rv.d - r.d + 7) / 4))
        c.group.visible = fade > 0.02
        lean(c, rv.vx, rv.slow > 0 ? Math.sin(t * 30 + i) * 0.2 : 0, fade)
        c.group.children.forEach((o) => { if (o !== c.sp[0] && o !== c.sp[1] && o !== c.sp[2]) (o as THREE.Sprite).material.opacity = fade })
      })
      shadow.position.x = cx; shadow.position.z = cz
      // 카메라: 차 뒤에서 조금 옆으로 따라간다(속도가 빠를수록 살짝 멀어진다)
      camX += (cx * 0.6 - camX) * Math.min(1, dt * 6)
      s.view.target.set(camX, 1.4, cz - 3.6)
      s.view.dist = 13.5 + Math.min(1.5, r.speed / 25) + (r.boost > 0 ? 1.2 : 0)
      sparkleSp.visible = r.sparkle > 0; sparkleSp.position.set(cx, 2.2 + (0.6 - r.sparkle) * 0.8, cz - 0.5)
      dustSp.visible = r.dust > 0; dustSp.position.set(cx, 1.2, cz - 0.3); dustSp.scale.setScalar(1 + (0.7 - r.dust) * 1.2)
      // 나무
      const period = PROPS * PROP_GAP
      for (const tr of props) { const base = -tr.k * PROP_GAP; tr.o.position.z = base + period * Math.floor((cz + 25 - base) / period) }
      const cp = CHEERS * CHEER_GAP
      for (const c of cheers) { const base = -30 - c.k * CHEER_GAP; c.o.position.z = base + cp * Math.floor((cz + 25 - base) / cp) }
      const fp = FLOWERS * FLOWER_GAP
      for (const f of flowers) { const base = -8 - f.k * FLOWER_GAP; f.o.position.z = base + fp * Math.floor((cz + 25 - base) / fp) }
      // 아이템
      const want = new Set<number>()
      for (const it of itemsBetween(r.d - 20, r.d + 110, r.seed)) {
        if (r.taken.includes(it.id)) continue
        want.add(it.id)
        let g = shown.get(it.id)
        if (!g) { g = itemMesh(it.kind); g.position.set(it.lane * LANE_W, 0, -it.d); scene.add(g); shown.set(it.id, g) }
        if (it.kind === 'star') (g.userData.m as THREE.Sprite).position.y = 0.9 + Math.sin(t * 5 + it.id) * 0.1
        else if (it.kind === 'boost') (g.userData.m as THREE.Sprite).position.y = 1.0 + Math.sin(t * 4 + it.id) * 0.12
      }
      for (const [id, g] of shown) if (!want.has(id)) { scene.remove(g); shown.delete(id) }
    })
    return () => s.dispose()
  }, [live, theme, carId])
  return <div ref={host} aria-hidden className="absolute inset-0" />
}
