import * as THREE from 'three'
import { assetUrl } from '../lib/items'

/**
 * 3D 시험판(산책·농장)이 같이 쓰는 바탕: 하늘·햇빛·잔디·구름, 종이 인형(지금 그림을 세운 판),
 * 아바타 걷기(땅 누르기·키보드), 카메라 따라가기·끌어서 둘레 돌기, 가리는 나무 흐리게.
 * 장면마다 다른 것(길·밭·집)은 쓰는 쪽에서 scene 에 더하고, onFrame 으로 매 프레임 일을 붙인다.
 */
export const AVATAR_H = 2.2 // 아바타 키(장면 단위)
export const FEET = 1504 / 1536 // 아바타 그림에서 발바닥 높이 비율
export const ANIMAL_H = AVATAR_H * (2 / 3) // 동물 친구는 아바타 키의 2/3
const SPEED = 4.2
const TAP_MOVE = 8

/** 같은 값을 늘 같게 내는 난수(새로 열어도 마을 모양이 같게) */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

export interface Doll { root: THREE.Group; body: THREE.Group; doll: THREE.Mesh }
export interface Mover { x: number; z: number }
export interface World {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  ground: THREE.Mesh
  rnd: () => number
  me: Mover & { dir: 1 | -1; moving: boolean }
  /** 걸을 때 부딪히는 것(나무·집·울타리): 동그라미 */
  obstacles: { x: number; z: number; r: number }[]
  keep: <T extends { dispose: () => void }>(x: T) => T
  lambert: (color: number) => THREE.MeshLambertMaterial
  texOf: (src: HTMLCanvasElement | string) => THREE.Texture
  paperDoll: (tex: THREE.Texture, h: number, aspect: number, feet?: number) => Doll
  addTree: (x: number, z: number, s: number) => void
  setAvatar: (canvas: HTMLCanvasElement) => void
  /** 그곳까지 걸어간다. 닿으면(dist 안쪽) arrive 를 부른다 */
  walkTo: (x: number, z: number, arrive?: () => void, dist?: number) => void
  /** 판이 카메라를 보게 돌리고(세로축) 좌우로 뒤집는다 */
  face: (d: Doll, dir: 1 | -1) => void
  /** 화면 오른쪽 방향(카메라 기준): 걷는 방향이 화면 왼쪽인지 오른쪽인지 잴 때 */
  screenSide: (dx: number, dz: number) => number
  pushOut: (o: Mover, r: number) => void
  onFrame: (fn: (dt: number, now: number) => void) => void
  /** 누른 곳에 맞은 물체 중 이것들 안에 든 것이 있으면 onPick, 아니면 땅을 누른 것(걷기) */
  pickables: THREE.Object3D[]
  dispose: () => void
}

export function createWorld(el: HTMLElement, opts: { bounds: number; start: Mover; /** 처음 카메라 방향(0 이면 -z 쪽을 본다) */ yaw?: number; /** 땅 무늬 그림 주소(없으면 연두색) */ grass?: string; seed?: number; sky?: number; onPick?: (o: THREE.Object3D) => void; onReady?: () => void }): World {
  const rnd = seeded(opts.seed ?? 7)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const dom = renderer.domElement
  el.appendChild(dom)
  Object.assign(dom.style, { display: 'block', touchAction: 'none', width: '100%', height: '100%' })

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(opts.sky ?? 0xbfe6ff)
  scene.fog = new THREE.Fog(0xd9f0ff, 35, 95)
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88bb66, 1.6))
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 })
  scene.add(sun, sun.target)

  const owned: { dispose: () => void }[] = []
  const keep = <T extends { dispose: () => void }>(x: T) => (owned.push(x), x)
  const lambert = (color: number) => keep(new THREE.MeshLambertMaterial({ color }))

  const B = opts.bounds
  // 땅: grass 를 주면 그 무늬 그림(카페 잔디)을 이어 깔고, 아니면 연두색 + 얼룩
  const loaderG = new THREE.TextureLoader()
  const grassTex = opts.grass ? loaderG.load(opts.grass) : null
  if (grassTex) { grassTex.colorSpace = THREE.SRGBColorSpace; grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set((B * 3) / 8, (B * 3) / 8); keep(grassTex) }
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(B * 3, B * 3)), grassTex ? keep(new THREE.MeshLambertMaterial({ map: grassTex })) : lambert(0x8fd16a))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  if (!grassTex) {
  const patchGeo = keep(new THREE.CircleGeometry(1, 20))
  for (let i = 0; i < 40; i++) {
    const p = new THREE.Mesh(patchGeo, lambert(rnd() < 0.5 ? 0x9edb76 : 0x84c860))
    p.rotation.x = -Math.PI / 2
    p.position.set((rnd() - 0.5) * B * 2, 0.005, (rnd() - 0.5) * B * 2)
    p.scale.setScalar(2 + rnd() * 5)
    p.receiveShadow = true
    scene.add(p)
  }
  }

  // 구름
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

  const loader = new THREE.TextureLoader()
  const texOf = (src: HTMLCanvasElement | string) => {
    const t = typeof src === 'string' ? loader.load(src) : new THREE.CanvasTexture(src)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return keep(t)
  }
  // 나무: 카페와 같은 3D 나무 그림을 세운 판. 카메라와 아바타 사이를 가리면 숨긴다
  const obstacles: World['obstacles'] = []
  const fadeable: { x: number; z: number; doll: Doll }[] = []
  let treeTex: THREE.Texture | null = null
  const addTree = (x: number, z: number, s: number) => {
    treeTex ??= texOf(assetUrl('cafe/3d/tree.webp'))
    const d = paperDoll(treeTex, 4.2 * s, 951 / 1024)
    d.root.position.set(x, 0, z)
    obstacles.push({ x, z, r: 0.6 * s })
    fadeable.push({ x, z, doll: d })
  }
  const paperDoll = (tex: THREE.Texture, h: number, aspect: number, feet = 1): Doll => {
    const g = keep(new THREE.PlaneGeometry(h * aspect, h))
    g.translate(0, h / 2 - h * (1 - feet), 0)
    const doll = new THREE.Mesh(g, keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide })))
    const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(h * 0.2, 24)), keep(new THREE.MeshBasicMaterial({ color: 0x3c5a2a, transparent: true, opacity: 0.28, depthWrite: false })))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.02
    shadow.scale.set(1.3, 0.75, 1)
    const root = new THREE.Group(), body = new THREE.Group()
    body.add(doll)
    root.add(shadow, body)
    scene.add(root)
    return { root, body, doll }
  }

  // 아바타
  const me = { x: opts.start.x, z: opts.start.z, dir: 1 as 1 | -1, moving: false }
  let avatar: Doll | null = null, walkT = 0
  const setAvatar = (cv: HTMLCanvasElement) => {
    const tex = texOf(cv)
    if (avatar) { const m = avatar.doll.material as THREE.MeshBasicMaterial; m.map = tex; m.needsUpdate = true }
    else { avatar = paperDoll(tex, AVATAR_H, 1024 / 1536, FEET); opts.onReady?.() }
  }

  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(1, h)
    camera.fov = w < h ? 62 : 50
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(el)

  // 걷기 목표
  let target: { x: number; z: number; arrive?: () => void; dist: number } | null = null
  const marker = new THREE.Mesh(keep(new THREE.RingGeometry(0.3, 0.45, 24)), keep(new THREE.MeshBasicMaterial({ color: 0xff8fab, transparent: true, opacity: 0.85, depthWrite: false })))
  marker.rotation.x = -Math.PI / 2
  marker.visible = false
  scene.add(marker)
  const walkTo = (x: number, z: number, arrive?: () => void, dist = 0.15) => {
    target = { x, z, arrive, dist }
    marker.position.set(x, 0.03, z)
    marker.visible = !arrive
  }

  // 조작
  let yaw = opts.yaw ?? 0
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const pickables: THREE.Object3D[] = []
  let press: { x: number; y: number; yaw: number; dragged: boolean } | null = null
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
      const hit = pickables.length ? ray.intersectObjects(pickables, true)[0] : undefined
      if (hit && opts.onPick) {
        let o: THREE.Object3D | null = hit.object
        while (o && !pickables.includes(o)) o = o.parent
        if (o) opts.onPick(o)
      } else {
        const g = ray.intersectObject(ground)[0]
        if (g) walkTo(g.point.x, g.point.z)
      }
    }
    press = null
  }
  dom.addEventListener('pointerdown', onDown)
  dom.addEventListener('pointermove', onMove)
  dom.addEventListener('pointerup', onUp)
  dom.addEventListener('pointercancel', onUp)
  const keys = new Set<string>()
  const kd = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') return; keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault() }
  const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
  window.addEventListener('keydown', kd)
  window.addEventListener('keyup', ku)

  const pushOut = (o: Mover, r: number) => {
    for (const t of obstacles) {
      const dx = o.x - t.x, dz = o.z - t.z, d = Math.hypot(dx, dz), min = t.r + r
      if (d < min && d > 1e-4) { o.x = t.x + (dx / d) * min; o.z = t.z + (dz / d) * min }
    }
    o.x = Math.max(-B, Math.min(B, o.x))
    o.z = Math.max(-B, Math.min(B, o.z))
  }
  const right = new THREE.Vector3()
  const screenSide = (dx: number, dz: number) => dx * right.x + dz * right.z
  const face = (d: Doll, dir: 1 | -1) => {
    d.body.rotation.y = Math.atan2(camera.position.x - d.root.position.x, camera.position.z - d.root.position.z)
    d.doll.scale.x = dir
  }

  const frameFns: ((dt: number, now: number) => void)[] = []
  const camPos = new THREE.Vector3(), look = new THREE.Vector3()
  let last = performance.now(), frame = 0
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    right.set(Math.cos(yaw), 0, -Math.sin(yaw))
    const fx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0)
    const fz = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
    let mx = 0, mz = 0
    if (fx || fz) {
      target = null; marker.visible = false
      const vx = -Math.sin(yaw) * fz + right.x * fx, vz = -Math.cos(yaw) * fz + right.z * fx, l = Math.hypot(vx, vz)
      mx = vx / l; mz = vz / l
    } else if (target) {
      const dx = target.x - me.x, dz = target.z - me.z, d = Math.hypot(dx, dz)
      if (d < target.dist) { const done = target.arrive; target = null; marker.visible = false; done?.() } else { mx = dx / d; mz = dz / d }
    }
    me.moving = !!(mx || mz)
    if (me.moving) {
      me.x += mx * SPEED * dt; me.z += mz * SPEED * dt
      pushOut(me, 0.45)
      const side = screenSide(mx, mz)
      if (Math.abs(side) > 0.2) me.dir = side > 0 ? 1 : -1
      walkT += dt
    }
    camPos.set(me.x + Math.sin(yaw) * 8, 4.2, me.z + Math.cos(yaw) * 8)
    camera.position.lerp(camPos, 1 - Math.pow(0.002, dt))
    look.set(me.x, 1.3, me.z)
    camera.lookAt(look)
    sun.position.set(me.x + 18, 30, me.z + 12)
    sun.target.position.set(me.x, 0, me.z)
    if (avatar) {
      avatar.root.position.set(me.x, 0, me.z)
      avatar.body.position.y = me.moving ? Math.abs(Math.sin(walkT * 9)) * 0.12 : 0
      face(avatar, me.dir)
    }
    // 카메라와 아바타 사이를 가리는 나무는 거의 투명하게
    const cx = camera.position.x, cz = camera.position.z, sx = me.x - cx, sz = me.z - cz, len2 = sx * sx + sz * sz || 1
    for (const t of fadeable) {
      const u = Math.max(0, Math.min(1, ((t.x - cx) * sx + (t.z - cz) * sz) / len2))
      t.doll.root.visible = !(Math.hypot(cx + sx * u - t.x, cz + sz * u - t.z) < 2.4 && u < 0.97)
      face(t.doll, 1)
    }
    for (const c of clouds) { c.position.x += dt * 0.6; if (c.position.x > 90) c.position.x = -90 }
    marker.scale.setScalar(1 + Math.sin(now / 200) * 0.08)
    for (const fn of frameFns) fn(dt, now)
    renderer.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)

  return {
    scene, camera, ground, rnd, me, obstacles, keep, lambert, texOf, paperDoll, addTree, setAvatar, walkTo, face, screenSide, pushOut, pickables,
    onFrame: (fn) => { frameFns.push(fn) },
    dispose: () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      owned.forEach((x) => x.dispose())
      renderer.dispose()
      dom.remove()
    },
  }
}

/** ✨ 반짝이·💧 같은 글자 그림 하나를 텍스처로(종이 인형·표시용) */
export function emojiCanvas(text: string, size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.font = `${size * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, size / 2, size * 0.55)
  return c
}
