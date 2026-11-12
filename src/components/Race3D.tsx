import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { LANE_W, LAP, LAPS, curveAt, curveSlope, itemsBetween, type ItemKind, type Race } from '../lib/race'
import { assetUrl } from '../lib/items'
import { savedName } from '../lib/mp/session'
import { createStage } from './stage3d'

/**
 * 자동차 레이스 3D 무대: 차 뒤에서 따라가며 본다. 길은 앞(-z)으로 뻗고 차는 +z 에서 -z 로 달린다.
 * 부스터·바나나·반짝이·먼지는 public/race/ 그림, 아직 그림이 없는 차·별·물웅덩이·길가는 임시 도형이다(그림이 오면 car/itemMesh 만 바꾸면 된다).
 */
/** 길(연석 포함) 너비: 아스팔트가 칸 수만큼(LANE_W*칸)이 되도록 그림 비율(연석 150px, 칸마다 137px)에 맞춘다 */
const roadWidth = (lanes: number) => LANE_W * lanes + (150 / 410) * LANE_W * 3
/** 길 그림 한 장이 덮는 길이(그림 비율 유지) */
const ROAD_TILE = roadWidth(3) * (951 / 512)
const GROUND_TILE = 10
const PROPS = 20, PROP_GAP = 11

export type RaceTheme = 'meadow' | 'snow' | 'candy' | 'fruit' | 'sea'
export type RaceCar = 'heart' | 'cloud' | 'blue' | 'bunny' | 'star'
/** 자동차 그림 크기(픽셀): 같은 눈금으로 줄여서 똑바로·왼쪽·오른쪽 크기가 서로 맞는다. 1픽셀 = CAR_K 장면 단위 */
const CAR_PX: Record<RaceCar, Record<'straight' | 'left' | 'right', [number, number]>> = {
  heart: { straight: [457, 414], left: [512, 408], right: [485, 379] },
  cloud: { straight: [477, 369], left: [492, 392], right: [504, 403] },
  blue: { straight: [493, 561], left: [532, 497], right: [532, 500] },
  bunny: { straight: [493, 533], left: [532, 504], right: [532, 532] },
  star: { straight: [493, 430], left: [532, 374], right: [532, 374] },
}
/** 운전하는 아이가 그림에 들어 있는 차(내 차일 때만 쓴다. 친구 차는 빈 그림 + 동물) */
const DRIVER_PX: Partial<Record<RaceCar, Record<'straight' | 'left' | 'right', [number, number]>>> = {
  blue: { straight: [493, 561], left: [532, 497], right: [532, 500] },
  star: { straight: [493, 504], left: [532, 485], right: [532, 439] },
  bunny: { straight: [493, 533], left: [532, 504], right: [532, 532] },
  cloud: { straight: [477, 440], left: [492, 432], right: [504, 406] },
  heart: { straight: [457, 414], left: [512, 409], right: [485, 427] },
}
/** 모든 차가 비슷한 크기로 보이게 맞추는 기준 넓이(픽셀², 다섯 차 똑바로 그림 넓이의 평균쯤) */
const CAR_AREA = 237000
/** 차 크기(이전보다 70%) */
const CAR_K = 4.3 * 0.7 / 457
/** 친구 차로 쓰는 차 그림들(내 차는 빼고 돌려 쓴다) */
export const ALL_CARS: RaceCar[] = ['heart', 'cloud', 'blue', 'bunny', 'star']
/** 장소마다 하늘색(하늘 그림 아래·안개), 길가 소품 */
const THEMES: Record<RaceTheme, { sky: number; prop: 'tree' | 'lollipop' | 'xmas' | 'fruit' | 'sea' }> = {
  meadow: { sky: 0xc9ecff, prop: 'tree' },
  snow: { sky: 0xdad6f6, prop: 'xmas' },
  candy: { sky: 0xffc9e3, prop: 'lollipop' },
  fruit: { sky: 0xffd6c4, prop: 'fruit' },
  sea: { sky: 0x9fe6ef, prop: 'sea' },
}

export function Race3D({ live, theme, car: carId }: { live: MutableRefObject<Race>; theme: RaceTheme; car: RaceCar }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const th = THEMES[theme]
    const LANES = live.current.lanes
    const ROAD_W = roadWidth(LANES)
    const s = createStage(el, { sky: th.sky, fog: [60, 170], shadows: false, view: { yaw: 0, pitch: 0.36, dist: 10.5, target: [0, 0.9, 0] }, fov: (w, h) => (w < h ? 66 : 48) })
    const { scene, keep } = s
    s.camera.far = 600
    s.camera.updateProjectionMatrix()
    const art = (name: string) => s.texOf(assetUrl(`race/${name}.webp`))
    const rep = (t: THREE.Texture) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t }

    // 먼 하늘: 하늘 그림을 멀리 세워 두고 늘 카메라를 따라온다(언덕 아랫단이 땅 끝과 만나게)
    // 세로 화면은 기존 하늘 그림 한 장, 가로 화면은 따로 만든 넓은 하늘 그림 한 장(이어 붙이지 않는다). 화면 방향이 바뀌면 그림을 바꾼다
    const skyPortrait = art(`sky_${theme}`), skyLand = art(`sky_${theme}_wide`)
    const SKY_H = 110, SKY_Z = 230
    const skyMat = keep(new THREE.MeshBasicMaterial({ map: skyPortrait, fog: false, depthWrite: false }))
    const sky = new THREE.Mesh(keep(new THREE.PlaneGeometry(3, 1)), skyMat)
    sky.scale.set(SKY_H * 3, SKY_H, 1)
    // 하늘 그림 바닥에서 위로 30% 되는 곳(언덕이 땅과 만나는 자리)의 높이를 세로 화면 그대로(HORIZON_Y)로 고정하고, 크기만 바꾼다
    const HORIZON_Y = (1 - 0.25 * SKY_H) + 0.3 * SKY_H
    const placeSky = (h: number) => { sky.position.y = HORIZON_Y - 0.3 * h + h / 2 }
    placeSky(SKY_H)
    sky.renderOrder = -1
    scene.add(sky)

    // 땅·길: 차를 따라 움직이는 판, 무늬는 반대로 밀어서 땅에 붙어 있게 한다
    const gTex = rep(art(`ground_${theme}`))
    gTex.repeat.set(500 / GROUND_TILE, 500 / GROUND_TILE)
    const grass = new THREE.Mesh(keep(new THREE.PlaneGeometry(500, 500)), keep(new THREE.MeshBasicMaterial({ map: gTex })))
    grass.rotation.x = -Math.PI / 2
    scene.add(grass)
    const rt = rep(art(LANES === 5 ? `road5_${theme}` : `road_${theme}`))
    rt.repeat.set(1, 260 / ROAD_TILE)
    // 길은 앞으로 길게 뻗은 판을 잘게(세로 90조각) 나눠, 조각마다 옆으로 옮겨서 휘어 보이게 한다
    const ROAD_SEG = 90, ROAD_LEN = 260
    const road = new THREE.Mesh(keep(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN, 1, ROAD_SEG)), keep(new THREE.MeshBasicMaterial({ map: rt })))
    road.rotation.x = -Math.PI / 2
    const roadPos = road.geometry.attributes.position as THREE.BufferAttribute
    const roadRows = ROAD_SEG + 1
    const roadBaseY = Array.from({ length: roadRows }, (_, i) => roadPos.getY(i * 2)) // 판 안의 앞뒤 자리(−130~130): 정점은 행마다 2개(왼·오른)
    road.position.y = 0.02
    scene.add(road)

    // 바퀴 시작·끝 줄(땅에 깐 체크무늬)과 결승 아치(세워 둔 그림, 가운데는 비어 있어서 차가 지나간다)
    // 땅에 깐 체크 줄(얇고 납작하게, 차와 아치 아래에 그려서 차 위로 올라오지 않는다)과 세워 둔 아치
    const archTex = art('arch'), lineTex = art('startline')
    const lineW = LANE_W * LANES + 0.8
    // 반듯하게 편 체크무늬 그림(세 줄)을 땅에 납작하게 깐다: 폭에 비해 얇게, 차와 아치보다 먼저 그려서 차 아래로
    const lineGeo = keep(new THREE.PlaneGeometry(lineW, 1.7))
    const lineMat = keep(new THREE.MeshBasicMaterial({ map: lineTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
    const ARCH_W = ROAD_W + 3
    const archGeo = keep(new THREE.PlaneGeometry(ARCH_W, ARCH_W * (538 / 768)))
    // 아치는 거리 순서로 그리고 깊이는 쓰지 않는다(차가 아치 밑을 지날 때 반쪽으로 잘리지 않게)
    const archMat = keep(new THREE.MeshBasicMaterial({ map: archTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
    // 출발 문은 차 앞 14칸에 한 번만. 바퀴·결승 문은 거리 그대로
    const gates: { o: THREE.Object3D; d: number }[] = []
    const gateZ = (k: number) => (k === 0 ? -14 : -k * LAP)
    for (let k = 0; k <= LAPS; k++) {
      const m = new THREE.Mesh(lineGeo, lineMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(0, 0.04, gateZ(k)); gates.push({ o: m, d: -gateZ(k) })
      m.renderOrder = -0.6
      scene.add(m)
      const arch = new THREE.Mesh(archGeo, archMat)
      // 아치도 다른 그림처럼 카메라 거리로 앞뒤가 정해지게 둔다(뒤에 있는 나무·구경꾼이 아치 위로 올라오지 않게). 차는 따로 순서를 정해 늘 위에 그린다
      arch.position.set(0, ARCH_W * (538 / 768) / 2 - 0.2, gateZ(k)); gates.push({ o: arch, d: -gateZ(k) })
      scene.add(arch)
    }

    // 길가: 장소마다 다른 나무(뒤로 지나가면 앞으로 옮겨 다시 쓴다) + 응원하는 곰 + 표지판
    const sideX = ROAD_W / 2 + 3
    const spriteOf = (tex: THREE.Texture, w: number, h: number, y: number) => { const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))); sp.scale.set(w, h, 1); sp.position.y = y; return sp }
    // [그림 이름, 높이, 가로세로 비율] — 높이 대비 폭은 spriteOf(w, h) 순서에 맞춰 아래에서 곱한다
    const CANDY_BIG: [string, number, number][] = [['cd_cotton_pink', 4.4, 0.85], ['cd_lolli_a', 4.4, 0.74], ['cd_cotton_blue', 4.4, 0.81], ['prop_lollipop', 4.8, 0.65], ['cd_lolli_b', 4.4, 0.74]]
    const SNOW_BIG: [string, number, number][] = [['prop_xmas', 4.7, 0.72], ['sn_pine', 4.0, 1.03], ['sn_pinelit', 4.0, 1.01], ['prop_xmas', 4.7, 0.72], ['sn_bare', 4.0, 1.07]]
    // 과일 마을: 레몬·오렌지·초록 나무와 딸기집·사과집을 번갈아 [그림, 높이, 가로세로 비율]
    const FRUIT_BIG: [string, number, number][] = [['fr_tree_green', 4.4, 0.93], ['fr_tree_lemon', 4.4, 0.95], ['fr_tree_orange', 4.4, 0.95], ['fr_strawhouse', 3.8, 1.04], ['fr_tree_orange', 4.4, 0.95], ['fr_tree_lemon', 4.4, 0.95], ['fr_applehouse', 3.8, 1.01], ['fr_tree_green', 4.4, 0.93]]
    // 바닷속 마을: 큰 길가 자리는 산호 5종에 조개집·소라집·잠수함을 섞는다 [그림, 높이, 가로세로 비율]
    const SEA_BIG: [string, number, number][] = [['sea_coral_pink', 4.2, 0.93], ['sea_coral_purple', 3.8, 1.04], ['sea_shellhouse', 4.2, 1.03], ['sea_coral_kelp', 4.4, 0.92], ['sea_coral_anemone', 3.6, 1.06], ['sea_conch', 4.2, 1.04], ['sea_coral_brain', 3.6, 1.03], ['sea_submarine', 3.8, 1.07]]
    const props = Array.from({ length: PROPS }, (_, i) => {
      const side = i % 2 ? 1 : -1, x = side * (sideX + (i % 3) * 2.2), z = -i * PROP_GAP
      const big = 0.9 + (i % 3) * 0.2
      const o = th.prop === 'tree' ? (i % 4 === 1 ? spriteOf(art('prop_tree2'), 4.7 * big, 4.4 * big, 2.2 * big) : spriteOf(art('prop_tree'), 4.6 * big, 4.2 * big, 2.1 * big))
        : th.prop === 'fruit' ? (() => { const [img, h, asp] = FRUIT_BIG[i % FRUIT_BIG.length]; return spriteOf(art(img), h * big * asp, h * big, h * big / 2) })()
        : th.prop === 'sea' ? (() => { const [img, h, asp] = SEA_BIG[i % SEA_BIG.length]; return spriteOf(art(img), h * big * asp, h * big, h * big / 2) })()
        : th.prop === 'xmas' ? (() => { const [img, h, asp] = SNOW_BIG[i % SNOW_BIG.length]; return spriteOf(art(img), h * big * asp, h * big, h * big / 2) })() : (() => { const [img, h, asp] = CANDY_BIG[i % CANDY_BIG.length]; return spriteOf(art(img), h * big * asp, h * big, h * big / 2) })()
      o.position.x = x; o.position.z = z; scene.add(o)
      return { o, k: i, x0: x }
    })
    // 길가 구경거리: 그림마다 쓰는 곳이 정해져 있다(초원: 토끼·꽃무더기 / 사탕 나라: 곰·풍선·사탕 나라 모음 / 눈 나라: 눈 나라 모음·크리스마스 나무)
    // [그림 이름, 높이, 가로세로 비율]
    type Art = [string, number, number]
    const meadow = theme === 'meadow', candy = theme === 'candy', snow = theme === 'snow', fruit = theme === 'fruit', sea = theme === 'sea'
    const CHEER: Art[] = meadow ? [['prop_bunny', 3.0, 0.83]] : candy ? [
      ['prop_bear', 2.6, 1.04], ['cd_castle', 4.6, 0.92], ['prop_balloons', 3.2, 0.68], ['cd_lamp_a', 3.8, 0.54], ['cd_cakehouse', 3.6, 0.93], ['cd_cart', 2.8, 0.94],
      ['cd_ginger', 3.2, 1.0], ['cd_lamp_b', 3.8, 0.51], ['cd_fountain', 2.8, 1.05], ['prop_lamp', 3.8, 0.44], ['cd_umbrella', 2.6, 1.09], ['cd_cupcake', 2.4, 0.86],
      ['cd_bench', 1.9, 1.32], ['cd_sign', 2.6, 0.93], ['cd_fence', 1.6, 1.77], ['prop_balloons', 3.2, 0.68],
    ] : sea ? [
      ['sea_turtlelamp', 3.8, 0.77], ['sea_clambench', 1.9, 1.18], ['sea_starsign', 3.2, 0.64], ['sea_pearlbridge', 1.8, 1.69], ['sea_bubblecart', 2.8, 0.89], ['sea_jellyballoon', 3.4, 0.83],
      ['sea_urchin', 3.0, 0.9], ['sea_turtlelamp', 3.8, 0.77], ['sea_chest', 2.4, 1.18], ['sea_octopus', 3.0, 0.99], ['sea_starsign', 3.2, 0.64], ['sea_clambench', 1.9, 1.18],
    ] : fruit ? [
      ['fr_pinefountain', 2.8, 1.03], ['fr_orangelamp', 3.8, 0.66], ['fr_fruitstand', 3.0, 1.03], ['fr_melonbench', 1.9, 1.38], ['fr_peachhouse', 3.4, 1.04], ['fr_lemoncart', 2.8, 0.9],
      ['fr_cherrysign', 3.2, 0.68], ['fr_kiwiparasol', 2.8, 0.96], ['fr_grapeballoon', 3.4, 0.67], ['fr_bananabridge', 1.8, 1.75], ['fr_orangelamp', 3.8, 0.66], ['fr_strawhouse', 3.0, 1.04],
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
      return { o, k: i, x0: o.position.x }
    })
    const GROUND: Art[] = meadow ? [['prop_flowers', 1.1, 1.55]] : candy ? [
      ['cd_bush', 1.2, 1.52], ['cd_gummy', 1.0, 1.5], ['cd_candy', 0.9, 1.5], ['cd_peppermint', 1.0, 1.03], ['cd_jelly', 1.1, 0.98], ['cd_gummybear', 1.3, 0.81],
      ['cd_heartcookie', 1.0, 1.08], ['cd_starface', 1.1, 0.99],
    ] : fruit ? [
      // 과일 마을 바닥 과일은 눈에 확 띄게 크게(수박·오렌지·딸기 등 높이 2.4~3.2)
      ['fg_strawbush', 2.6, 1.34], ['fg_blueberry', 2.4, 1.35], ['fg_orangeslice', 2.0, 1.58], ['fg_melonslice', 2.8, 1.1], ['fg_cherry', 2.6, 1.06], ['fg_flowers', 1.6, 1.7], ['fg_pineapple', 3.2, 0.73],
    ] : snow ? [
      ['sn_rock', 1.3, 1.59], ['sn_holly', 1.3, 1.35], ['sn_iceplant', 1.5, 1.15], ['sn_crystal', 1.4, 1.15], ['sn_flake', 1.2, 0.96], ['sn_gifts', 1.2, 1.23],
    ] : []
    const FLOWERS = GROUND.length ? (fruit ? 20 : sea ? 12 : 14) : 0, FLOWER_GAP = fruit ? 12 : sea ? 20 : 17
    const flowers = Array.from({ length: FLOWERS }, (_, i) => {
      const [img, h, asp] = GROUND[i % GROUND.length]
      const o = spriteOf(art(img), h * asp, h, h / 2)
      o.position.set((i % 2 ? 1 : -1) * (ROAD_W / 2 + (fruit ? 2.3 : 0.9) + (i % 3) * 0.5), h / 2, -8 - i * FLOWER_GAP)
      scene.add(o)
      return { o, k: i, x0: o.position.x }
    })
    for (let k = 0; k <= LAPS; k++) { const o = spriteOf(signTex, 2.3, 2.1, 1.05); o.position.set(-(ROAD_W / 2 + 1.5), 1.05, gateZ(k) + 9); scene.add(o) }

    // 차: 그림 판 세 장(똑바로·왼쪽·오른쪽)을 겹쳐 두고, 옆으로 움직이는 속도에 따라 서서히 섞는다(뚝 바뀌지 않고 미끄러지듯)
    const buildCar = (id: RaceCar, k0 = 1) => {
      const group = new THREE.Group()
      // 차마다 그림 크기가 달라서(하트 차는 낮고 작고, 파랑·번개 차는 높다) 그림이 차지하는 넓이를 같게 맞춘다
      const px0 = (DRIVER_PX[id] || CAR_PX[id]).straight
      const k = k0 * Math.sqrt(CAR_AREA / (px0[0] * px0[1]))
      const sp = (['straight', 'left', 'right'] as const).map((v) => {
        const drv = DRIVER_PX[id]
        const [pw, ph] = (drv ? drv : CAR_PX[id])[v]
        const m = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: art(`${drv ? 'car_d' : 'car'}_${id}_${v}`), transparent: true, depthWrite: false })))
        m.center.set(0.5, 0.05); m.scale.set(pw * CAR_K * k, ph * CAR_K * k, 1)
        group.add(m); return m
      })
      scene.add(group)
      return { group, sp, h: (DRIVER_PX[id] || CAR_PX[id]).straight[1] * CAR_K * k }
    }
    const lean = (c: ReturnType<typeof buildCar>, vx: number, slip: number, fade = 1) => {
      const l = Math.max(-1, Math.min(1, vx / 1.6)), m = Math.abs(l)
      // 똑바로 그림은 옆 그림이 거의 다 덮일 때까지 그대로 둔다(둘 다 반투명해지면 차가 사라지는 것처럼 보인다)
      c.sp[0].material.opacity = Math.min(1, (1 - m) / 0.15) * fade
      c.sp[1].material.opacity = (l < 0 ? m : 0) * fade; c.sp[2].material.opacity = (l > 0 ? m : 0) * fade
      c.sp.forEach((x) => { x.material.rotation = slip + l * -0.07 })
    }
    // 차 위 닉네임표: 알약 모양 글자판(내 이름은 분홍, 친구는 연보라). 늘 카메라를 본다
    const nameTag = (c: ReturnType<typeof buildCar>, name: string, me: boolean) => {
      const cv = document.createElement('canvas'); cv.width = 384; cv.height = 96
      const g = cv.getContext('2d')!
      g.font = 'bold 44px "Apple SD Gothic Neo","Noto Sans KR",sans-serif'
      const w = Math.min(372, g.measureText(name).width + 48), x = (384 - w) / 2
      g.fillStyle = me ? '#ffffff' : '#e6d9ff'; g.strokeStyle = me ? '#ff8fab' : '#ffffff'; g.lineWidth = 7
      g.beginPath(); g.roundRect(x, 10, w, 76, 38); g.fill(); g.stroke()
      g.fillStyle = me ? '#e0567f' : '#5b3a7a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 192, 49)
      const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: s.texOf(cv), transparent: true, depthWrite: false })))
      // 번호판 자리(차 뒤쪽 아래 범퍼)에 작게: 시야를 가리지 않는다
      sp.scale.set(2.5, 0.62, 1); sp.position.set(0, c.h * 0.17, 0.05)
      c.group.add(sp); sp.renderOrder = 200; return sp
    }
    const mine = buildCar(carId)
    nameTag(mine, savedName() || '나', true)
    const car = mine.group
    // 컴퓨터 친구 차: 내가 고른 차가 아닌 다른 차들을 돌려 쓴다(차 그림에 운전자가 이미 타 있다)
    // 내가 고른 차를 뺀 나머지 4대 중에서 판마다 무작위로(같은 판이면 같은 차) 골라 태운다
    const sd = live.current.seed
    const others = ALL_CARS.filter((c) => c !== carId).map((c, i) => ({ c, k: Math.sin(sd * 12.9898 + i * 78.233) })).sort((a, b) => a.k - b.k).map((x) => x.c)
    const rivalCars = live.current.rivals.map((_rv, i) => {
      const nc = live.current.rivals[i]?.net?.car as RaceCar | undefined
      const id = nc && nc in CAR_PX ? nc : others[i % others.length], c = buildCar(id, 0.92)
      nameTag(c, live.current.rivals[i]?.net?.name ?? `컴퓨터${i + 1}`, false)
      return c
    })
    const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 20)), keep(new THREE.MeshBasicMaterial({ color: 0x3c4a2a, transparent: true, opacity: 0.25, depthWrite: false })))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; shadow.scale.set(1.26, 1.4, 1)
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
    const sparkleSp = spriteOf(art('fx_sparkle'), 1.7, 1.3, 1.0), dustSp = spriteOf(art(theme === 'sea' ? 'fx_bubbles' : 'fx_dust'), 2.4, 1.5, 0.9)
    sparkleSp.visible = dustSp.visible = false
    // 반짝이·먼지는 차보다 카메라 쪽(차 뒤)에 두고 맨 위에 그린다: 차에 가려 안 보이던 것을 보이게
    sparkleSp.renderOrder = dustSp.renderOrder = 300
    scene.add(sparkleSp, dustSp)
    // 바닷속 거품 3가지(바닷속에서만): ① 부스터 중 차 뒤로 계속 퍼지는 거품 ② 별 코인을 먹을 때 톡 올라오는 거품 ③ 화면에 천천히 떠다니는 거품
    const bubOn = theme === 'sea'
    const bubTex = bubOn ? art('fx_bubbles') : null
    type Bub = { sp: THREE.Sprite; life: number; max: number; vx: number; vy: number; s0: number }
    const bubbles: Bub[] = []
    const addBub = (x: number, y: number, z: number, size: number, max: number, vx: number, vy: number, op: number) => {
      const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: bubTex!, transparent: true, depthWrite: false, opacity: op })))
      sp.renderOrder = 290; sp.scale.setScalar(size); sp.position.set(x, y, z); scene.add(sp)
      bubbles.push({ sp, life: max, max, vx, vy, s0: size })
    }
    let lastStars = 0, boostAcc = 0, ambAcc = 0
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)

    let skyWide: number | null = null
    const drawRank = new Map<number, number>()
    let t = 0, camX = 0
    s.onFrame((dt) => {
      t += dt
      const r = live.current
      const cz = -r.d, cx = r.x * LANE_W
      grass.position.z = cz; grass.position.x = cx * 0; road.position.z = cz - 60
      // 휘는 길: 판의 각 가로줄을 (그 자리의 길 휘어짐 − 내 자리의 휘어짐)만큼 옆으로 옮긴다
      const c0 = curveAt(r.d, r.seed)
      const curveX = (d: number) => curveAt(d, r.seed) - c0
      for (const g of gates) g.o.position.x = curveX(g.d) // 아치·체크 줄도 길 가운데를 따라간다(곧은 구간이라 사실상 0)
      for (let i = 0; i < roadRows; i++) {
        // 눕힌 판의 +y 가 앞쪽(−z)이고 판 가운데는 내 앞 60 에 있다: 행의 앞쪽 거리 = 내 거리 + 60 + (판 안의 y)
        const dd = r.d + 60 + roadBaseY[i]
        const ox = curveX(dd)
        roadPos.setX(i * 2, -ROAD_W / 2 + ox); roadPos.setX(i * 2 + 1, ROAD_W / 2 + ox)
      }
      roadPos.needsUpdate = true
      gTex.offset.y = -cz / GROUND_TILE; rt.offset.y = -cz / ROAD_TILE
      const sz = s.size(), wide = sz.w > sz.h
      // 가로 화면은 그림이 화면 폭을 덮도록 키운다(보이는 폭 ≈ 2·거리·tan(시야/2)·가로세로비). 세로 화면은 기존 크기 그대로
      const skyKey = wide ? Math.round((sz.w / sz.h) * 100) : -1
      if (skyKey !== skyWide) {
        skyWide = skyKey
        const visW = 214.6 * (sz.w / sz.h)
        const w = wide ? Math.max(SKY_H * 3, visW * 1.08) : SKY_H * 3, h = w / 3
        skyMat.map = wide ? skyLand : skyPortrait; skyMat.needsUpdate = true
        sky.scale.set(w, h, 1); placeSky(h)
      }
      // 하늘은 길이 휘는 반대쪽으로 아주 조금 밀어서, 커브를 돌 때 먼 풍경이 함께 도는 느낌을 준다
      sky.position.x = cx * 0.6 - curveSlope(r.d + 40, r.seed) * 35; sky.position.z = cz - SKY_Z
      // 차: 옆 칸으로 가는 동안은 그쪽 그림, 달릴 땐 통통, 미끄러지면 빙글 흔들
      car.position.set(cx, Math.abs(Math.sin(t * 14)) * 0.05 * Math.min(1, r.speed / 20), cz)
      lean(mine, r.vx, r.slow > 0 ? Math.sin(t * 30) * 0.22 : 0)
      r.rivals.forEach((rv, i) => {
        const c = rivalCars[i]
        if (!c) return // 친구 차 그림이 아직 없으면 건너뛴다(여기서 오류가 나면 화면 전체가 멈춘다)
        c.group.position.set(rv.x * LANE_W + curveX(rv.d), Math.abs(Math.sin(t * 14 + i)) * 0.05 * Math.min(1, rv.speed / 20), -rv.d)
        // 내 차 뒤로 처진 친구는 카메라 앞을 가리지 않게 서서히 사라진다
        const fade = Math.max(0, Math.min(1, (rv.d - r.d + 7) / 4))
        c.group.visible = fade > 0.02
        lean(c, rv.vx, rv.slow > 0 ? Math.sin(t * 30 + i) * 0.2 : 0, fade)
        c.group.children.forEach((o) => { if (o !== c.sp[0] && o !== c.sp[1] && o !== c.sp[2]) (o as THREE.Sprite).material.opacity = fade })
      })
      shadow.position.x = cx; shadow.position.z = cz
      // 카메라: 차 뒤에서 조금 옆으로 따라간다(속도가 빠를수록 살짝 멀어진다)
      camX += (cx * 0.6 - camX) * Math.min(1, dt * 6)
      // 카메라는 차 뒤에 그대로 둔다(옮기면 차가 화면 옆으로 밀려난다). 커브는 길·소품이 휘는 것만으로 보인다
      s.view.target.set(camX, 1.0, cz - 3.2)
      s.view.dist = 11 + (LANES - 3) * 1.6 + Math.min(1.5, r.speed / 25) + (r.boost > 0 ? 1.2 : 0)
      if (bubOn) {
        // ① 부스터 중: 0.06초마다 차 뒤에서 작은 거품이 옆으로 퍼지며 올라간다
        if (r.boost > 0) { boostAcc += dt; while (boostAcc > 0.06) { boostAcc -= 0.06; addBub(cx + rnd(-0.8, 0.8), rnd(0.5, 1.0), cz + rnd(0.3, 0.9), rnd(0.25, 0.5), rnd(0.7, 1.1), rnd(-0.7, 0.7), rnd(0.8, 1.6), 0.85) } } else boostAcc = 0
        // ② 별 코인을 먹었으면(별 수가 늘었으면) 차 앞쪽에서 거품 몇 개가 톡 올라온다
        if (r.stars > lastStars) { for (let k = 0; k < 6; k++) addBub(cx + rnd(-0.6, 0.6), rnd(1.0, 1.6), cz + rnd(-0.8, 0.0), rnd(0.25, 0.5), rnd(0.6, 0.9), rnd(-0.5, 0.5), rnd(1.4, 2.4), 0.95) }
        lastStars = r.stars
        // ③ 떠다니는 거품: 길 양옆 멀리서 천천히 올라가며 사라진다(적게, 시야를 가리지 않게)
        ambAcc += dt; while (ambAcc > 0.5) { ambAcc -= 0.5; const side = Math.random() < 0.5 ? -1 : 1; addBub(cx + side * rnd(3, 9), rnd(0.2, 2.5), cz - rnd(4, 22), rnd(0.4, 0.9), rnd(3, 5), rnd(-0.1, 0.1), rnd(0.25, 0.5), 0.55) }
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i]; b.life -= dt
          if (b.life <= 0) { scene.remove(b.sp); bubbles.splice(i, 1); continue }
          const k = b.life / b.max
          b.sp.position.x += b.vx * dt; b.sp.position.y += b.vy * dt
          b.sp.material.opacity = Math.min(0.95, k * 1.6) * (b.s0 < 0.7 && b.max > 2 ? 0.6 : 1)
        }
      }
      sparkleSp.visible = r.sparkle > 0; sparkleSp.position.set(cx, 0.55 + (0.6 - r.sparkle) * 0.5, cz + 1.0)
      dustSp.visible = r.dust > 0; dustSp.position.set(cx, 0.5, cz + 0.9); dustSp.scale.setScalar(0.7 + Math.max(0, 0.7 - r.dust) * 0.9)
      // 나무
      const period = PROPS * PROP_GAP
      // 출발·결승 아치 앞뒤 18칸에는 나무·구경꾼·꽃을 두지 않는다(아치와 겹쳐 보이지 않게)
      const nearGate = (z: number) => { for (let k = 0; k <= LAPS; k++) if (Math.abs(z - gateZ(k)) < 18) return true; return false }
      for (const tr of props) { const base = -tr.k * PROP_GAP; tr.o.position.z = base + period * Math.floor((cz + 25 - base) / period); tr.o.position.x = tr.x0 + curveX(-tr.o.position.z); tr.o.visible = !nearGate(tr.o.position.z) }
      const cp = CHEERS * CHEER_GAP
      for (const c of cheers) { const base = -30 - c.k * CHEER_GAP; c.o.position.z = base + cp * Math.floor((cz + 25 - base) / cp); c.o.position.x = c.x0 + curveX(-c.o.position.z); c.o.visible = !nearGate(c.o.position.z) }
      const fp = FLOWERS * FLOWER_GAP
      for (const f of flowers) { const base = -8 - f.k * FLOWER_GAP; f.o.position.z = base + fp * Math.floor((cz + 25 - base) / fp); f.o.position.x = f.x0 + curveX(-f.o.position.z); f.o.visible = !nearGate(f.o.position.z) }
      // 겹친 차 그리는 순서: 반투명 그림은 카메라 거리로 정렬되는데, 두 차가 나란히 겹치면 순서가 프레임마다 뒤집혀 탁탁 튄다.
      // 그래서 순서를 직접 정한다(앞서 달리는 차를 먼저 그림). 거리가 0.8 안쪽으로 비슷하면 직전 순서를 그대로 둔다.
      const cars = [{ c: mine, d: r.d, k: 0 }, ...r.rivals.map((rv, i) => ({ c: rivalCars[i], d: rv.d, k: i + 1 })).filter((x) => x.c)]
      cars.sort((a, b) => (Math.abs(a.d - b.d) < 0.8 ? (drawRank.get(a.k) ?? a.k) - (drawRank.get(b.k) ?? b.k) : b.d - a.d))
      cars.forEach((x, idx) => { drawRank.set(x.k, idx); x.c.sp.forEach((m) => { m.renderOrder = 10 + idx * 3 }) })
      // 아이템
      const want = new Set<number>()
      for (const it of itemsBetween(r.d - 20, r.d + 110, r.seed, r.lanes)) {
        if (r.taken.includes(it.id)) continue
        want.add(it.id)
        let g = shown.get(it.id)
        if (!g) { g = itemMesh(it.kind); g.position.set(it.lane * LANE_W, 0, -it.d); scene.add(g); shown.set(it.id, g) }
        g.position.x = it.lane * LANE_W + curveX(it.d)
        if (it.kind === 'star') (g.userData.m as THREE.Sprite).position.y = 0.9 + Math.sin(t * 5 + it.id) * 0.1
        else if (it.kind === 'boost') (g.userData.m as THREE.Sprite).position.y = 1.0 + Math.sin(t * 4 + it.id) * 0.12
      }
      for (const [id, g] of shown) if (!want.has(id)) { scene.remove(g); shown.delete(id) }
    })
    return () => s.dispose()
  }, [live, theme, carId])
  return <div ref={host} aria-hidden className="absolute inset-0" />
}
