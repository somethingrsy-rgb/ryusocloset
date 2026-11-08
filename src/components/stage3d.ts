import * as THREE from 'three'

/**
 * 3D(카페·주방·축구·달리기·방)이 같이 쓰는 무대: 그리기·빛·크기 맞추기·매 프레임 일·누르기·끌어서 둘러보기.
 * 게임 규칙과 버튼·말풍선은 원래 화면 것을 그대로 쓰고, 무대는 그림만 3D 로 그린다.
 * - 카메라는 target 을 바라보며 yaw(옆으로)·pitch(위아래)·dist(거리)로 둘레를 돈다. orbit 이 켜져 있으면 끌어서 돌린다.
 * - project 로 3D 자리를 화면 자리(px)로, ground 로 화면 자리를 땅(y=0) 위 자리로 바꾼다(원래 화면의 HTML 단추를 3D 위에 띄울 때).
 */
export interface Doll { root: THREE.Group; body: THREE.Group; doll: THREE.Mesh; mat: THREE.MeshBasicMaterial }
export interface Stage {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  keep: <T extends { dispose: () => void }>(x: T) => T
  lambert: (color: number) => THREE.MeshLambertMaterial
  texOf: (src: HTMLCanvasElement | string) => THREE.Texture
  /** 지금 그림을 세운 판(발이 원점). face 로 늘 카메라를 보게 한다 */
  paperDoll: (tex: THREE.Texture | null, h: number, aspect: number, feet?: number, shadow?: boolean) => Doll
  face: (d: Doll, flip?: 1 | -1) => void
  /** face 와 같고, 위에서 내려다볼 때 판을 카메라 쪽으로 조금 눕힌다(소품이 납작해 보이지 않게) */
  faceTilt: (d: Doll, k?: number) => void
  setMap: (d: Doll, tex: THREE.Texture, aspect?: number) => void
  view: { yaw: number; pitch: number; dist: number; target: THREE.Vector3 }
  onFrame: (fn: (dt: number, now: number) => void) => void
  /** 3D 자리 → 화면 자리(px, 무대 왼쪽 위 기준)와 앞에 있는지 */
  project: (p: THREE.Vector3) => { x: number; y: number; front: boolean }
  /** 화면 자리(px) → 땅(높이 h) 위 자리 */
  ground: (sx: number, sy: number, h?: number) => THREE.Vector3 | null
  size: () => { w: number; h: number }
  dispose: () => void
}

export function createStage(el: HTMLElement, opts: {
  sky?: number; fog?: [number, number] | null; orbit?: boolean; pitchRange?: [number, number]; yawRange?: [number, number]
  view: { yaw: number; pitch: number; dist: number; target: [number, number, number] }
  /** 끌지 않고 누른 곳에 맞은 물체(pickables 안의 것) */
  pickables?: THREE.Object3D[]; onPick?: (o: THREE.Object3D, sx: number, sy: number) => void
  /** 누른 곳에 물체가 없을 때(화면 자리 px) */
  onTap?: (sx: number, sy: number) => void
  fov?: (w: number, h: number) => number
  shadows?: boolean
}): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: opts.sky === undefined })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = opts.shadows !== false
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const dom = renderer.domElement
  el.appendChild(dom)
  Object.assign(dom.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' })

  const scene = new THREE.Scene()
  if (opts.sky !== undefined) scene.background = new THREE.Color(opts.sky)
  if (opts.fog) scene.fog = new THREE.Fog(opts.sky ?? 0xffffff, opts.fog[0], opts.fog[1])
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa0b890, 1.7))
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.4)
  sun.position.set(12, 24, 14)
  sun.castShadow = opts.shadows !== false
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 })
  scene.add(sun, sun.target)

  const owned: { dispose: () => void }[] = []
  const keep = <T extends { dispose: () => void }>(x: T) => (owned.push(x), x)
  const lambert = (color: number) => keep(new THREE.MeshLambertMaterial({ color }))
  const loader = new THREE.TextureLoader()
  const texOf = (src: HTMLCanvasElement | string) => {
    const t = typeof src === 'string' ? loader.load(src) : new THREE.CanvasTexture(src)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return keep(t)
  }
  const shadowGeo = keep(new THREE.CircleGeometry(1, 24))
  const paperDoll = (tex: THREE.Texture | null, h: number, aspect: number, feet = 1, withShadow = true): Doll => {
    const g = keep(new THREE.PlaneGeometry(1, 1))
    g.translate(0, 0.5 - (1 - feet), 0)
    const mat = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, visible: !!tex }))
    const doll = new THREE.Mesh(g, mat)
    doll.scale.set(h * aspect, h, 1)
    const root = new THREE.Group(), body = new THREE.Group()
    body.add(doll)
    root.add(body)
    if (withShadow) {
      const s = new THREE.Mesh(shadowGeo, keep(new THREE.MeshBasicMaterial({ color: 0x3c4a2a, transparent: true, opacity: 0.25, depthWrite: false })))
      s.rotation.x = -Math.PI / 2
      s.position.y = 0.02
      s.scale.set(h * 0.26, h * 0.15, 1)
      root.add(s)
    }
    scene.add(root)
    return { root, body, doll, mat }
  }
  const setMap = (d: Doll, tex: THREE.Texture, aspect?: number) => {
    d.mat.map = tex
    d.mat.visible = true
    d.mat.needsUpdate = true
    if (aspect) d.doll.scale.x = Math.sign(d.doll.scale.x || 1) * d.doll.scale.y * aspect
  }
  const face = (d: Doll, flip: 1 | -1 = 1) => {
    const p = new THREE.Vector3()
    d.root.getWorldPosition(p)
    d.body.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z) - d.root.rotation.y
    d.doll.scale.x = Math.abs(d.doll.scale.x) * flip
  }

  const faceTilt = (d: Doll, k = 0.6) => {
    face(d)
    const p = new THREE.Vector3()
    d.root.getWorldPosition(p)
    const dx = camera.position.x - p.x, dz = camera.position.z - p.z, dy = camera.position.y - p.y
    d.body.rotation.order = 'YXZ'
    d.body.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz)) * k
  }
  const view = { yaw: opts.view.yaw, pitch: opts.view.pitch, dist: opts.view.dist, target: new THREE.Vector3(...opts.view.target) }
  let W = 1, H = 1
  const resize = () => {
    W = el.clientWidth || 1; H = el.clientHeight || 1
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    camera.fov = opts.fov ? opts.fov(W, H) : W < H ? 60 : 45
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(el)

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const toNdc = (sx: number, sy: number) => ndc.set((sx / W) * 2 - 1, -(sy / H) * 2 + 1)
  let press: { x: number; y: number; yaw: number; pitch: number; dragged: boolean; id: number } | null = null
  const [pmin, pmax] = opts.pitchRange ?? [0.15, 1.2]
  const local = (e: PointerEvent) => { const r = dom.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const onDown = (e: PointerEvent) => { if (press) return; press = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, dragged: false, id: e.pointerId } }
  const onMove = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return
    const dx = e.clientX - press.x, dy = e.clientY - press.y
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) press.dragged = true
    if (press.dragged && opts.orbit) {
      view.yaw = press.yaw - dx * 0.008
      if (opts.yawRange) view.yaw = Math.max(opts.yawRange[0], Math.min(opts.yawRange[1], view.yaw))
      view.pitch = Math.max(pmin, Math.min(pmax, press.pitch + dy * 0.005))
    }
  }
  const onUp = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return
    if (!press.dragged) {
      const { x, y } = local(e)
      ray.setFromCamera(toNdc(x, y), camera)
      const list = opts.pickables ?? []
      // 그림의 투명한 곳을 누른 것은 건너뛴다(판은 네모지만 그림은 아니다)
      const hit = list.length ? ray.intersectObjects(list, true).find((h) => h.object.visible !== false && opaqueAt(h)) : undefined
      let o: THREE.Object3D | null = hit?.object ?? null
      while (o && !list.includes(o)) o = o.parent
      if (o && opts.onPick) opts.onPick(o, x, y)
      else opts.onTap?.(x, y)
    }
    press = null
  }
  dom.addEventListener('pointerdown', onDown)
  dom.addEventListener('pointermove', onMove)
  dom.addEventListener('pointerup', onUp)
  dom.addEventListener('pointercancel', onUp)

  const v = new THREE.Vector3()
  /** 누른 자리의 그림이 불투명한지(그림을 한 번 작은 캔버스에 그려 두고 알파를 읽는다) */
  const alphaCache = new WeakMap<object, { data: Uint8ClampedArray; w: number; h: number } | null>()
  const opaqueAt = (h: THREE.Intersection) => {
    const mat = (h.object as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined
    const img = mat?.map?.image as (CanvasImageSource & { width: number; height: number }) | undefined
    if (!h.uv || !img || !img.width) return true
    let a = alphaCache.get(img)
    if (a === undefined) {
      try {
        const c = document.createElement('canvas'), w = (c.width = 128), hh = (c.height = 128)
        const g = c.getContext('2d', { willReadFrequently: true })!
        g.drawImage(img, 0, 0, w, hh)
        a = { data: g.getImageData(0, 0, w, hh).data, w, h: hh }
      } catch { a = null }
      alphaCache.set(img, a)
    }
    if (!a) return true
    const x = Math.min(a.w - 1, Math.max(0, Math.floor(h.uv.x * a.w))), y = Math.min(a.h - 1, Math.max(0, Math.floor((1 - h.uv.y) * a.h)))
    return a.data[(y * a.w + x) * 4 + 3] > 40
  }
  const project = (p: THREE.Vector3) => {
    v.copy(p).project(camera)
    return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, front: v.z < 1 }
  }
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const ground = (sx: number, sy: number, h = 0) => {
    ray.setFromCamera(toNdc(sx, sy), camera)
    plane.constant = -h
    const out = new THREE.Vector3()
    return ray.ray.intersectPlane(plane, out)
  }
  const place = () => {
    const cp = Math.cos(view.pitch)
    camera.position.set(view.target.x + Math.sin(view.yaw) * cp * view.dist, view.target.y + Math.sin(view.pitch) * view.dist, view.target.z + Math.cos(view.yaw) * cp * view.dist)
    camera.lookAt(view.target)
    sun.position.set(view.target.x + 12, 24, view.target.z + 14)
    sun.target.position.copy(view.target)
  }
  place()

  const fns: ((dt: number, now: number) => void)[] = []
  let last = performance.now(), frame = 0
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    for (const fn of fns) fn(dt, now)
    place()
    renderer.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)

  return {
    scene, camera, renderer, keep, lambert, texOf, paperDoll, face, faceTilt, setMap, view, project, ground,
    size: () => ({ w: W, h: H }),
    onFrame: (fn) => { fns.push(fn) },
    dispose: () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      owned.forEach((x) => x.dispose())
      renderer.dispose()
      dom.remove()
    },
  }
}

/** 글자(이모지) 하나를 그림으로 */
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

/** 동글동글한 나무 한 그루(줄기 + 잎 셋) */
export function cuteTree(s: Stage, x: number, z: number, scale: number, leaf: number) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(s.keep(new THREE.CylinderGeometry(0.22, 0.32, 1.6, 8)), s.lambert(0x9a6b45))
  trunk.position.y = 0.8
  trunk.castShadow = true
  g.add(trunk)
  const lg = s.keep(new THREE.IcosahedronGeometry(1, 1)), lm = s.lambert(leaf)
  ;[[0, 2.1, 0, 1.05], [0.35, 2.55, 0.2, 0.85], [-0.3, 2.9, -0.1, 0.65]].forEach(([lx, ly, lz, ls]) => {
    const l = new THREE.Mesh(lg, lm)
    l.position.set(lx, ly, lz)
    l.scale.setScalar(ls)
    l.castShadow = true
    g.add(l)
  })
  g.position.set(x, 0, z)
  g.scale.setScalar(scale)
  s.scene.add(g)
  return g
}
