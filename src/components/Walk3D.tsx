import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { renderFigure } from '../lib/exportPng'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'

/**
 * 3D 산책 (시험판): 마을은 3D(길·나무·집·꽃·구름)이고, 아바타와 동물 친구는 지금 그림을 세운 '종이 인형'이다.
 * 아바타 그림은 지금 입은 옷을 한 장으로 합쳐(renderFigure) 판에 붙이고, 판은 늘 카메라 쪽을 본다(세로축으로만 돈다).
 * 땅을 누르면 그곳으로 걸어가고, 끌면 카메라가 아바타 둘레를 돈다. 키보드(WASD·방향키)도 된다.
 */
const AVATAR_H = 2.2 // 아바타 키(장면 단위)
const FEET = 1504 / 1536 // 그림에서 발바닥 높이 비율
const ANIMAL_H = AVATAR_H * (2 / 3) // 동물 친구는 아바타 키의 2/3 (집 파티와 같은 비율)
const SPEED = 4.2 // 걷는 빠르기(단위/초)
const WORLD = 70 // 걸어 다닐 수 있는 범위(가운데에서 ±)
const TAP_MOVE = 8 // 이만큼(px)보다 덜 움직이면 '누르기', 더 움직이면 '끌기'

/** 0~1 사이 같은 값을 늘 같게 내는 난수(새로 열어도 마을 모양이 같게) */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/** 판(종이 인형): 발이 원점에 오게 옮긴 평면. 그림자 대신 발밑에 둥근 그림자 */
function paperDoll(tex: THREE.Texture, h: number, aspect: number, feet = 1) {
  const g = new THREE.PlaneGeometry(h * aspect, h)
  g.translate(0, h / 2 - h * (1 - feet), 0)
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide })
  const doll = new THREE.Mesh(g, m)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(h * 0.2, 24), new THREE.MeshBasicMaterial({ color: 0x3c5a2a, transparent: true, opacity: 0.28, depthWrite: false }))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  shadow.scale.set(1.3, 0.75, 1)
  const root = new THREE.Group()
  const body = new THREE.Group() // 걷는 통통 움직임은 이 층에만
  body.add(doll)
  root.add(shadow, body)
  return { root, body, doll }
}

export function Walk3D({ outfit, tweaks, onExit }: { outfit: Outfit; tweaks: Tweaks; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let disposed = false
    const rnd = seeded(7)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xbfe6ff)
    scene.fog = new THREE.Fog(0xd9f0ff, 35, 95)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300)

    // 빛: 하늘빛 + 햇빛(그림자)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x88bb66, 1.6))
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.6)
    sun.position.set(18, 30, 12)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 })
    scene.add(sun, sun.target)

    const owned: { dispose: () => void }[] = []
    const keep = <T extends { dispose: () => void }>(x: T) => (owned.push(x), x)
    const lambert = (color: number) => keep(new THREE.MeshLambertMaterial({ color }))

    // 땅: 잔디 + 조금 밝은 풀밭 얼룩
    const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(WORLD * 3, WORLD * 3)), lambert(0x8fd16a))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)
    const patchGeo = keep(new THREE.CircleGeometry(1, 20))
    for (let i = 0; i < 40; i++) {
      const p = new THREE.Mesh(patchGeo, lambert(rnd() < 0.5 ? 0x9edb76 : 0x84c860))
      p.rotation.x = -Math.PI / 2
      p.position.set((rnd() - 0.5) * WORLD * 2, 0.005, (rnd() - 0.5) * WORLD * 2)
      p.scale.setScalar(2 + rnd() * 5)
      p.receiveShadow = true
      scene.add(p)
    }

    // 산책길: 구불구불한 띠(흙길) — 앞뒤로 길게
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => new THREE.Vector3(Math.sin(i * 1.3) * 9, 0, -WORLD + (i * WORLD * 2) / 8)))
    const samples = curve.getSpacedPoints(240)
    const roadW = 3.4
    const pos: number[] = [], idx: number[] = []
    samples.forEach((p, i) => {
      const t = curve.getTangentAt(i / (samples.length - 1))
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(roadW / 2)
      pos.push(p.x + n.x, 0.02, p.z + n.z, p.x - n.x, 0.02, p.z - n.z)
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    })
    const roadGeo = keep(new THREE.BufferGeometry())
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    roadGeo.setIndex(idx)
    roadGeo.computeVertexNormals()
    const road = new THREE.Mesh(roadGeo, keep(new THREE.MeshLambertMaterial({ color: 0xf1d9a6, side: THREE.DoubleSide })))
    road.receiveShadow = true
    scene.add(road)
    // 길 가장자리 돌멩이
    const stoneGeo = keep(new THREE.SphereGeometry(0.18, 8, 6))
    const stoneMat = lambert(0xe3e0d6)
    samples.forEach((p, i) => {
      if (i % 4) return
      const t = curve.getTangentAt(i / (samples.length - 1))
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize()
      for (const s of [1, -1]) {
        const st = new THREE.Mesh(stoneGeo, stoneMat)
        st.position.copy(p).addScaledVector(n, s * (roadW / 2 + 0.15)).setY(0.06)
        st.scale.set(1, 0.6, 1)
        scene.add(st)
      }
    })
    const nearRoad = (x: number, z: number, d: number) => samples.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < d * d)

    // 나무: 갈색 줄기 + 동글동글한 잎(초록·벚꽃 분홍). 길 위에는 두지 않는다
    const trees: { x: number; z: number; r: number }[] = []
    /** 카메라와 아바타 사이를 가리는 나무는 반투명하게(나무마다 재질을 따로 둔다) */
    const fadeable: { x: number; z: number; mats: THREE.MeshLambertMaterial[]; o: number }[] = []
    const trunkGeo = keep(new THREE.CylinderGeometry(0.22, 0.32, 1.6, 8))
    const leafGeo = keep(new THREE.IcosahedronGeometry(1, 1))
    const trunkMat = lambert(0x9a6b45)
    const leafMats = [0x6cc35a, 0x5fb24f, 0x7ad06a, 0xffb7cf, 0xffc9dc].map(lambert)
    for (let i = 0; i < 400 && trees.length < 110; i++) {
      // 절반은 길가(길에서 5~14 떨어진 곳)에, 나머지는 들판 아무 데나
      const s0 = samples[Math.floor(rnd() * samples.length)], a = rnd() * Math.PI * 2, far = 6 + rnd() * 8
      const [x, z] = i % 2 ? [s0.x + Math.cos(a) * far, s0.z + Math.sin(a) * far] : [(rnd() - 0.5) * WORLD * 1.9, (rnd() - 0.5) * WORLD * 1.9]
      if (nearRoad(x, z, 4.5) || trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 9)) continue
      const s = 0.8 + rnd() * 0.7
      const tree = new THREE.Group()
      const tMat = keep(trunkMat.clone()), lMat = keep(leafMats[Math.floor(rnd() * leafMats.length)].clone())
      for (const m of [tMat, lMat]) m.transparent = true
      const trunk = new THREE.Mesh(trunkGeo, tMat)
      trunk.position.y = 0.8
      trunk.castShadow = true
      tree.add(trunk)
      for (let k = 0; k < 3; k++) {
        const leaf = new THREE.Mesh(leafGeo, lMat)
        leaf.position.set((rnd() - 0.5) * 0.9, 2 + k * 0.45, (rnd() - 0.5) * 0.9)
        leaf.scale.setScalar(1.05 - k * 0.2)
        leaf.castShadow = true
        tree.add(leaf)
      }
      tree.position.set(x, 0, z)
      tree.scale.setScalar(s)
      scene.add(tree)
      trees.push({ x, z, r: 0.6 * s })
      fadeable.push({ x, z, mats: [tMat, lMat], o: 1 })
    }

    // 집: 길가에 파스텔 벽 + 빨간 지붕 + 문·창문
    const houseSpots = [0.15, 0.38, 0.62, 0.85]
    const wallMats = [0xfff1d6, 0xffe0ec, 0xe3f1ff, 0xfdf6c8].map(lambert)
    const roofMat = lambert(0xe2574c), doorMat = lambert(0x9a6b45), winMat = lambert(0x9fd8ff)
    houseSpots.forEach((u, k) => {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u)
      const side = k % 2 ? 1 : -1
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(side * 6.5)
      const house = new THREE.Group()
      const wall = new THREE.Mesh(keep(new THREE.BoxGeometry(3.6, 2.6, 3.2)), wallMats[k])
      wall.position.y = 1.3
      const roof = new THREE.Mesh(keep(new THREE.ConeGeometry(2.9, 1.8, 4)), roofMat)
      roof.position.y = 3.5
      roof.rotation.y = Math.PI / 4
      const door = new THREE.Mesh(keep(new THREE.BoxGeometry(0.9, 1.5, 0.08)), doorMat)
      door.position.set(0, 0.75, 1.62)
      const win = new THREE.Mesh(keep(new THREE.BoxGeometry(0.7, 0.7, 0.08)), winMat)
      win.position.set(1.1, 1.7, 1.62)
      const win2 = win.clone()
      win2.position.x = -1.1
      for (const m of [wall, roof]) { m.castShadow = true; m.receiveShadow = true }
      house.add(wall, roof, door, win, win2)
      house.position.copy(p).add(n)
      house.lookAt(p) // 문이 길 쪽을 본다
      scene.add(house)
      trees.push({ x: house.position.x, z: house.position.z, r: 2.5 })
    })

    // 꽃: 작은 동그라미를 한꺼번에(InstancedMesh)
    const flowerGeo = keep(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 8)) // 납작한 꽃송이
    const flowerMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff }))
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 700)
    const mtx = new THREE.Matrix4(), col = new THREE.Color()
    const flowerColors = [0xff8fb1, 0xffd54a, 0xffffff, 0xc7a6ff, 0xff9e6b]
    for (let i = 0; i < 700; i++) {
      const s = samples[Math.floor(rnd() * samples.length)]
      const a = rnd() * Math.PI * 2, d = roadW / 2 + 0.6 + rnd() * 7
      mtx.makeScale(0.6 + rnd() * 0.6, 1, 0.6 + rnd() * 0.6).setPosition(s.x + Math.cos(a) * d, 0.04, s.z + Math.sin(a) * d)
      flowers.setMatrixAt(i, mtx)
      flowers.setColorAt(i, col.setHex(flowerColors[Math.floor(rnd() * flowerColors.length)]))
    }
    scene.add(flowers)

    // 구름: 하얀 공 몇 개를 뭉쳐서 천천히 흘려 보낸다
    const cloudGeo = keep(new THREE.SphereGeometry(1, 12, 10))
    const cloudMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35 }))
    const clouds: THREE.Group[] = []
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Group()
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(cloudGeo, cloudMat)
        b.position.set(k * 1.4 - 2, rnd() * 0.6, (rnd() - 0.5) * 1.2)
        b.scale.setScalar(1.2 + rnd() * 0.8)
        c.add(b)
      }
      c.position.set((rnd() - 0.5) * 160, 18 + rnd() * 8, (rnd() - 0.5) * 160)
      scene.add(c)
      clouds.push(c)
    }

    // 종이 인형: 아바타(지금 입은 옷) + 동물 친구 넷
    const loader = new THREE.TextureLoader()
    const texOf = (src: CanvasImageSource | string) => {
      const t = typeof src === 'string' ? loader.load(src) : new THREE.CanvasTexture(src as HTMLCanvasElement)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      return keep(t)
    }
    const me = { x: samples[20].x, z: samples[20].z, dir: 1 as 1 | -1, moving: false, t: 0 }
    let avatar: ReturnType<typeof paperDoll> | null = null
    renderFigure(outfit, tweaks).then((cv) => {
      if (disposed) return
      avatar = paperDoll(texOf(cv), AVATAR_H, 1024 / 1536, FEET)
      scene.add(avatar.root)
      setReady(true)
    }).catch(() => setReady(true))

    const friends = [0, 2, 4, 6].map((a, k) => {
      const d = paperDoll(texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[a].img}_stand.webp`)), ANIMAL_H, 1)
      const s = samples[30 + k * 25]
      const f = { doll: d, x: s.x + (k % 2 ? 2.2 : -2.2), z: s.z, tx: 0, tz: 0, wait: rnd() * 2, dir: 1 as 1 | -1, t: rnd() * 5 }
      f.tx = f.x; f.tz = f.z
      scene.add(d.root)
      return f
    })

    // 크기
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / Math.max(1, h)
      camera.fov = w < h ? 62 : 50
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // 조작: 누르면 그곳으로 걷기, 끌면 둘레 돌기, 키보드
    let yaw = 0, target: THREE.Vector3 | null = null
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
    let press: { x: number; y: number; yaw: number; dragged: boolean } | null = null
    const marker = new THREE.Mesh(keep(new THREE.RingGeometry(0.3, 0.45, 24)), keep(new THREE.MeshBasicMaterial({ color: 0xff8fab, transparent: true, opacity: 0.85, depthWrite: false })))
    marker.rotation.x = -Math.PI / 2
    marker.visible = false
    scene.add(marker)
    const dom = renderer.domElement
    const onDown = (e: PointerEvent) => { dom.setPointerCapture(e.pointerId); press = { x: e.clientX, y: e.clientY, yaw, dragged: false } }
    const onMove = (e: PointerEvent) => {
      if (!press) return
      const dx = e.clientX - press.x
      if (Math.abs(dx) > TAP_MOVE || Math.abs(e.clientY - press.y) > TAP_MOVE) press.dragged = true
      if (press.dragged) yaw = press.yaw - dx * 0.008
    }
    const onUp = (e: PointerEvent) => {
      if (press && !press.dragged) {
        const r = dom.getBoundingClientRect()
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        ray.setFromCamera(ndc, camera)
        const hit = ray.intersectObject(ground)[0]
        if (hit) { target = hit.point.clone(); marker.position.set(target.x, 0.03, target.z); marker.visible = true }
      }
      press = null
    }
    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointercancel', onUp)
    const keys = new Set<string>()
    const kd = (e: KeyboardEvent) => { keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault() }
    const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    /** 나무·집에 부딪히면 밖으로 밀어 낸다 */
    const pushOut = (o: { x: number; z: number }, r: number) => {
      for (const t of trees) {
        const dx = o.x - t.x, dz = o.z - t.z, d = Math.hypot(dx, dz), min = t.r + r
        if (d < min && d > 1e-4) { o.x = t.x + (dx / d) * min; o.z = t.z + (dz / d) * min }
      }
      o.x = Math.max(-WORLD, Math.min(WORLD, o.x))
      o.z = Math.max(-WORLD, Math.min(WORLD, o.z))
    }
    const camPos = new THREE.Vector3(), look = new THREE.Vector3()
    const right = new THREE.Vector3()
    /** 판이 카메라를 보게(세로축으로만) 돌리고, 걷는 방향이 화면 왼쪽이면 그림을 뒤집는다 */
    const face = (d: ReturnType<typeof paperDoll>, dir: 1 | -1) => {
      d.body.rotation.y = Math.atan2(camera.position.x - d.root.position.x, camera.position.z - d.root.position.z)
      d.doll.scale.x = dir
    }

    let last = performance.now(), frame = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // 키보드: 카메라 기준 앞·뒤·옆
      const fx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0)
      const fz = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      right.set(Math.cos(yaw), 0, -Math.sin(yaw))
      let mx = 0, mz = 0
      if (fx || fz) {
        target = null; marker.visible = false
        const v = fwd.clone().multiplyScalar(fz).addScaledVector(right, fx).normalize()
        mx = v.x; mz = v.z
      } else if (target) {
        const dx = target.x - me.x, dz = target.z - me.z, d = Math.hypot(dx, dz)
        if (d < 0.15) { target = null; marker.visible = false } else { mx = dx / d; mz = dz / d }
      }
      me.moving = !!(mx || mz)
      if (me.moving) {
        me.x += mx * SPEED * dt; me.z += mz * SPEED * dt
        pushOut(me, 0.45)
        const side = mx * right.x + mz * right.z // 화면에서 오른쪽(+)·왼쪽(-)
        if (Math.abs(side) > 0.2) me.dir = side > 0 ? 1 : -1
        me.t += dt
      }
      // 카메라: 아바타 뒤 위에서 부드럽게 따라온다
      camPos.set(me.x + Math.sin(yaw) * 8, 4.2, me.z + Math.cos(yaw) * 8)
      camera.position.lerp(camPos, 1 - Math.pow(0.002, dt))
      look.set(me.x, 1.3, me.z)
      camera.lookAt(look)
      sun.position.set(me.x + 18, 30, me.z + 12)
      sun.target.position.set(me.x, 0, me.z)
      if (avatar) {
        avatar.root.position.set(me.x, 0, me.z)
        avatar.body.position.y = me.moving ? Math.abs(Math.sin(me.t * 9)) * 0.12 : 0
        face(avatar, me.dir)
      }
      // 동물 친구: 근처를 거닐다 쉬었다 한다
      for (const f of friends) {
        f.t += dt
        if (f.wait > 0) f.wait -= dt
        else {
          const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz)
          if (d < 0.1) {
            f.wait = 1.5 + rnd() * 3
            const s = samples[Math.floor(rnd() * samples.length)]
            const near = Math.hypot(s.x - me.x, s.z - me.z) < 18 ? s : { x: me.x + (rnd() - 0.5) * 10, z: me.z + (rnd() - 0.5) * 10 }
            f.tx = near.x + (rnd() - 0.5) * 3; f.tz = near.z + (rnd() - 0.5) * 3
          } else {
            f.x += (dx / d) * SPEED * 0.55 * dt; f.z += (dz / d) * SPEED * 0.55 * dt
            const side = dx * right.x + dz * right.z
            if (Math.abs(side) > 0.05) f.dir = side > 0 ? 1 : -1
            pushOut(f, 0.35)
          }
        }
        f.doll.root.position.set(f.x, 0, f.z)
        f.doll.body.position.y = f.wait > 0 ? 0 : Math.abs(Math.sin(f.t * 8)) * 0.1
        face(f.doll, f.dir)
      }
      // 가리는 나무: 카메라→아바타 선분에서 3 안쪽이면 흐리게
      const cx = camera.position.x, cz = camera.position.z, sx = me.x - cx, sz = me.z - cz, len2 = sx * sx + sz * sz || 1
      for (const t of fadeable) {
        const u = Math.max(0, Math.min(1, ((t.x - cx) * sx + (t.z - cz) * sz) / len2))
        const block = Math.hypot(cx + sx * u - t.x, cz + sz * u - t.z) < 3.4 && u < 0.97
        const o = t.o + ((block ? 0.08 : 1) - t.o) * Math.min(1, dt * 8)
        if (Math.abs(o - t.o) > 0.002) { t.o = o; for (const m of t.mats) { m.opacity = o; m.depthWrite = o > 0.9 } }
      }
      for (const c of clouds) { c.position.x += dt * 0.6; if (c.position.x > 90) c.position.x = -90 }
      marker.scale.setScalar(1 + Math.sin(now / 200) * 0.08)
      renderer.render(scene, camera)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      ro.disconnect()
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[]; (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose()) } })
      owned.forEach((x) => x.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
    // 옷은 들어올 때 한 번만 그린다(산책 중에는 옷을 바꿀 수 없다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section aria-label="3D 산책" className="relative h-full overflow-hidden rounded-3xl bg-[#bfe6ff] select-none">
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#3d6b2f] shadow">🌳 3D 산책 <span className="text-xs font-bold text-black/40">시험판</span></span>
        <button aria-label="닫기" onClick={onExit} className="pointer-events-auto h-10 w-10 rounded-full bg-white/95 text-lg font-bold shadow">✕</button>
      </div>
      <p className="pointer-events-none absolute inset-x-2 bottom-3 z-10 m-0 text-center text-xs font-bold text-[#3d6b2f] drop-shadow-[0_1px_0_white]">땅을 누르면 걸어가요 · 옆으로 끌면 둘러봐요</p>
      {!ready && <p className="absolute inset-0 z-20 m-0 flex items-center justify-center text-sm font-bold text-[#3d6b2f]">마을을 만드는 중…</p>}
    </section>
  )
}
