/**
 * 도망간 별을 잡아라 3D 무대(카페·농장처럼 땅 위를 걷는 느낌): 내 캐릭터 뒤에서 낮게 따라가는 카메라, 끝없는 풀밭 타일,
 * 흙길·나무·덤불·꽃·돌·가로등·울타리(부딪힘 없는 장식), 먼 언덕. 하늘은 화면 뒤 배경 그림이다.
 * 규칙·판정은 하지 않고, 받은 좌표(필드 x,y → 세계 x,z)를 그리기만 한다.
 */
import * as THREE from 'three'
import { assetUrl } from '../lib/items'
import { CFG } from '../lib/starChase'
import { AVATAR_H, FEET, HOUSE_ART, createWorld, meadowTree, type Doll, type World } from './world3d'

export const SLOT_COLORS = ['#ff8fab', '#5fc27a', '#4aa6ea', '#a77be8']
export const SLOT_SHAPES = ['△', '◇', '□', '○']

export interface SceneFrame {
  players: { slot: number; x: number; y: number; mine: boolean; say: string | null }[]
  stars: { id: number; x: number; y: number; m: number }[]
  me: { x: number; y: number }
  fx: { k: 'fly' | 'miss'; x: number; y: number; u: number }[]
  calm: boolean
  now: number
}
/** 화면 밖에 있는 별·친구를 가리키는 화살표(화면 비율 0~1 좌표와 방향 각도) */
export interface EdgeArrow { x: number; y: number; rot: number; color: string }
export interface StarScene { setLook(slot: number, cv: HTMLCanvasElement): void; frame(f: SceneFrame): void; arrows: EdgeArrow[]; dispose(): void }

function glyphCanvas(text: string, color: string) {
  const c = document.createElement('canvas'); c.width = c.height = 96
  const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.beginPath(); g.arc(48, 48, 42, 0, 7); g.fill(); g.lineWidth = 7; g.strokeStyle = color; g.stroke()
  g.fillStyle = color; g.font = '900 56px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 48, 52); return c
}
function bubbleCanvas(text: string) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 96
  const g = c.getContext('2d')!; g.fillStyle = 'rgba(255,255,255,.97)'; g.strokeStyle = '#cdb8f2'; g.lineWidth = 6
  g.beginPath(); g.roundRect(6, 6, 308, 68, 30); g.fill(); g.stroke(); g.fillStyle = '#3b2a63'; g.font = '800 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 160, 42); return c
}
function zoneCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!; g.fillStyle = 'rgba(150,215,235,.28)'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill()
  g.lineWidth = 7; g.strokeStyle = 'rgba(255,255,255,.9)'; g.setLineDash([22, 16]); g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke(); return c
}
function glowCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!; const r = g.createRadialGradient(64, 64, 4, 64, 64, 64); r.addColorStop(0, 'rgba(255,240,150,.85)'); r.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c
}

export function createStarScene(el: HTMLElement): StarScene {
  const w: World = createWorld(el, { bounds: 60, start: { x: 0, z: 0 }, seed: 11, bare: true })
  const scene = w.scene, cam = w.camera
  scene.fog = new THREE.Fog(0x74c2a8, 38, 82)
  const hw = CFG.w / 2, hh = CFG.h / 2
  const tex = (name: string, rep?: [number, number]) => { const t = w.texOf(assetUrl(`starchase/${name}.webp`)); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]) } return t }
  // 끝없는 풀밭: 발밑이 흘러가 보이게 큰 판에 타일을 반복
  const grass = tex('grass', [300 / 7, 300 / 7])
  const ground = new THREE.Mesh(w.keep(new THREE.PlaneGeometry(300, 300)), w.keep(new THREE.MeshLambertMaterial({ map: grass })))
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground)
  // 먼 언덕: 늘 카메라 앞 먼 곳에 세워 두는 그림(땅 끝과 만나게)
  const hillsMat = w.keep(new THREE.MeshBasicMaterial({ map: tex('hills'), transparent: true, depthWrite: false, fog: false }))
  const hills = new THREE.Mesh(w.keep(new THREE.PlaneGeometry(1, 216 / 1600)), hillsMat); hills.renderOrder = -2; scene.add(hills)
  // 산책 마을 그대로: 한 바퀴 이어진 흙길, 길가 집 일곱 채, 초록·노랑·주황 나무, 꽃 덤불, 꽃송이. (하늘과 잔디만 별잡기 것)
  const rnd = w.rnd
  const clear = (x: number, z: number, m: number) => Math.abs(x) < hw + m && Math.abs(z) < hh + m
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, r = 30 + Math.sin(i * 2.3) * 4; return new THREE.Vector3(Math.cos(a) * r * 1.25, 0, Math.sin(a) * r) }), true)
  const samples = curve.getSpacedPoints(240)
  const roadW = 3.4
  {
    const pos: number[] = [], idx: number[] = [], uv: number[] = []
    let along = 0
    samples.forEach((p, i) => {
      const t = curve.getTangentAt(i / (samples.length - 1)), n = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(roadW / 2)
      pos.push(p.x + n.x, 0.02, p.z + n.z, p.x - n.x, 0.02, p.z - n.z)
      if (i) along += p.distanceTo(samples[i - 1])
      uv.push(0, along / roadW, 1, along / roadW)
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    })
    const geo = w.keep(new THREE.BufferGeometry())
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals()
    const dirt = w.texOf(assetUrl('cafe/3d/dirt.webp')); dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping
    scene.add(new THREE.Mesh(geo, w.keep(new THREE.MeshLambertMaterial({ map: dirt, side: THREE.DoubleSide }))))
  }
  const nearRoad = (x: number, z: number, d: number) => samples.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < d * d)
  HOUSE_ART.forEach((art, k) => {
    for (const u of k === 0 ? [0.02, 0.5] : k === 1 ? [0.12, 0.62] : k === 2 ? [0.22, 0.72] : [0.32, 0.82]) {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u), sd = (k + (u > 0.4 ? 1 : 0)) % 2 ? 1 : -1
      const hx = p.x + -t.z * sd * 6.5, hz = p.z + t.x * sd * 6.5
      if (!clear(hx, hz, 2)) w.addProp(art.img, hx, hz, 6, art.aspect, 2.5)
    }
  })
  let trees = 0
  for (let i = 0; i < 500 && trees < 120; i++) {
    const s0 = samples[Math.floor(rnd() * samples.length)], a = rnd() * Math.PI * 2, far = 6 + rnd() * 8
    const [x, z] = i % 2 ? [s0.x + Math.cos(a) * far, s0.z + Math.sin(a) * far] : [(rnd() - 0.5) * 120, (rnd() - 0.5) * 100]
    if (clear(x, z, 2) || nearRoad(x, z, 4.5) || w.obstacles.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 9)) continue
    w.addTree(x, z, 0.8 + rnd() * 0.5, meadowTree(rnd())); trees++
  }
  let bushes = 0
  for (let i = 0; i < 400 && bushes < 70; i++) {
    const s0 = samples[Math.floor(rnd() * samples.length)], a = rnd() * Math.PI * 2, far = 3.2 + rnd() * 4
    const [x, z] = i % 3 ? [s0.x + Math.cos(a) * far, s0.z + Math.sin(a) * far] : [(rnd() - 0.5) * 120, (rnd() - 0.5) * 100]
    if (nearRoad(x, z, 2.8) || w.obstacles.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + 1.4) ** 2)) continue
    w.addProp('cafe/3d/bush.webp', x, z, 0.9 + rnd() * 0.4, 1024 / 616, 0.45); bushes++
  }
  {
    const fl = new THREE.InstancedMesh(w.keep(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 8)), w.keep(new THREE.MeshLambertMaterial({ color: 0xffffff })), 900)
    const mtx = new THREE.Matrix4(), col = new THREE.Color(), colors = [0xff8fb1, 0xffd54a, 0xffffff, 0xc7a6ff, 0xff9e6b]
    for (let i = 0; i < 900; i++) {
      const sp = samples[Math.floor(rnd() * samples.length)], a = rnd() * Math.PI * 2, d = roadW / 2 + 0.6 + rnd() * 7, x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d
      mtx.makeScale(0.6 + rnd() * 0.6, 1, 0.6 + rnd() * 0.6).setPosition(x, 0.04, z); fl.setMatrixAt(i, mtx); fl.setColorAt(i, col.setHex(colors[Math.floor(rnd() * colors.length)]))
    }
    scene.add(fl)
  }

  const AH = AVATAR_H
  const KA = 1.5
  const glowTex = w.texOf(glowCanvas())
  const starTex = ['star_idle', 'star_flee', 'star_scared'].map((n) => tex(n))
  const starAspect = [320 / 298, 320 / 267, 320 / 351]
  const STAR_H = AH * KA * 0.52
  const burstTex = tex('burst')
  const mkRing = (color: number, op: number) => { const m = new THREE.Mesh(w.keep(new THREE.RingGeometry(0.9, 1.05, 40)), w.keep(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }))); m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.renderOrder = 2; scene.add(m); return m }
  const stars = new Map<number, { d: Doll[]; ring: THREE.Mesh; glow: THREE.Sprite }>()
  const newStar = () => {
    const d = starTex.map((t, i) => { const q = w.paperDoll(t, STAR_H, starAspect[i]); if (i) q.root.children[0].visible = false; return q })
    const glow = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))); glow.scale.set(STAR_H * 1.7, STAR_H * 1.7, 1); glow.renderOrder = 0; scene.add(glow)
    return { d, ring: mkRing(0xffffff, 0.9), glow }
  }
  const blank = document.createElement('canvas'); blank.width = 8; blank.height = 8
  type Kid = { d: Doll; ring: THREE.Mesh; tag: THREE.Sprite; arrow: THREE.Sprite; bub: THREE.Sprite; bubText: string; px: number; pz: number; dir: 1 | -1 }
  const kids: (Kid | null)[] = [null, null, null, null]
  const sprite = (cv: HTMLCanvasElement, sx: number, sy: number) => { const s = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ map: w.texOf(cv), transparent: true, depthWrite: false }))); s.scale.set(sx, sy, 1); s.renderOrder = 8; scene.add(s); return s }
  const kid = (slot: number): Kid => {
    let k = kids[slot]; if (k) return k
    const d = w.paperDoll(w.texOf(blank), AH, 1024 / 1536, FEET); d.root.scale.setScalar(KA)
    const ring = mkRing(parseInt(SLOT_COLORS[slot].slice(1), 16), 0.95); ring.scale.set(1.1, 1.1, 1.1)
    const tag = sprite(glyphCanvas(SLOT_SHAPES[slot], SLOT_COLORS[slot]), 1.1, 1.1)
    const arrow = sprite(glyphCanvas('▼', SLOT_COLORS[slot]), 0.9, 0.9)
    const bub = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))); bub.scale.set(4, 1.2, 1); bub.renderOrder = 9; bub.visible = false; scene.add(bub)
    k = { d, ring, tag, arrow, bub, bubText: '', px: 99, pz: 99, dir: 1 }; kids[slot] = k; return k
  }
  const catchRing = new THREE.Mesh(w.keep(new THREE.PlaneGeometry(CFG.catchR * 2, CFG.catchR * 2)), w.keep(new THREE.MeshBasicMaterial({ map: w.texOf(zoneCanvas()), transparent: true, depthWrite: false }))); catchRing.rotation.x = -Math.PI / 2; catchRing.position.y = 0.05; catchRing.renderOrder = 2; scene.add(catchRing)
  const fxStar: Doll[] = [], fxRing: THREE.Mesh[] = [], fxBurst: THREE.Sprite[] = []
  const t0 = performance.now()
  let pending: SceneFrame | null = null
  const out: StarScene = { setLook: (slot, cv) => { const m = kid(slot).d.doll.material as THREE.MeshBasicMaterial; m.map = w.texOf(cv); m.needsUpdate = true }, frame: (f) => { pending = f }, arrows: [], dispose: () => w.dispose() }
  w.onFrame((dt) => { if (pending) apply(pending, dt) })
  let camX = 0, camZ = 0, init = false
  const v3 = new THREE.Vector3()
  const edge = (x: number, y: number, z: number, color: string) => {
    v3.set(x, y, z).project(cam)
    const behind = v3.z > 1
    let nx = behind ? -v3.x : v3.x, ny = behind ? -v3.y : v3.y
    if (!behind && Math.abs(nx) <= 0.94 && Math.abs(ny) <= 0.86) return
    const k = Math.max(Math.abs(nx) / 0.9, Math.abs(ny) / 0.8) || 1; nx /= k; ny /= k
    out.arrows.push({ x: (nx + 1) / 2, y: (1 - ny) / 2, rot: Math.atan2(-ny, nx), color })
  }
  function apply(f: SceneFrame, dt: number) {
    const t = (f.now - t0) / 1000
    // 카메라: 내 뒤 낮은 곳에서 부드럽게 따라온다(캐릭터가 화면 아래쪽 1/3에 오게 조금 앞을 본다)
    if (!init) { camX = f.me.x; camZ = f.me.y; init = true }
    const kc = 1 - Math.exp(-dt * 5); camX += (f.me.x - camX) * kc; camZ += (f.me.y - camZ) * kc
    const portrait = cam.aspect < 1
    const dist = portrait ? 12.5 : 10.5, height = portrait ? 6.8 : 5.6, ahead = portrait ? 7.5 : 5.5
    cam.position.set(camX, height, camZ + dist); cam.lookAt(camX, 1.2, camZ - ahead)
    w.me.x = f.me.x; w.me.z = f.me.y
    // 먼 언덕: 카메라 앞 75 지점에 폭을 화면에 맞춰 세운다
    const D = 75, visW = 2 * D * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect * 1.25
    hills.scale.set(visW, visW, 1); hills.position.set(camX, (visW * 216 / 1600) / 2 - 1.2, camZ - D)
    // 별
    out.arrows = []
    const seen = new Set<number>()
    for (const s of f.stars) {
      seen.add(s.id)
      let o = stars.get(s.id); if (!o) { o = newStar(); stars.set(s.id, o) }
      const by = (s.m === 2 ? Math.sin(t * 14) * 0.04 : Math.abs(Math.sin(t * 4 + s.id)) * 0.35) + STAR_H * 0.08
      o.d.forEach((q, i) => { q.root.visible = i === s.m; q.root.position.set(s.x, 0, s.y); q.body.position.y = by; w.face(q, s.m === 1 && f.stars.length ? (Math.cos(t + s.id) > 0 ? 1 : -1) : 1) })
      o.glow.position.set(s.x, by + STAR_H * 0.5, s.y - 0.4); o.glow.material.opacity = s.m === 2 ? 0.7 + Math.sin(t * 10) * 0.15 : 0.5
      o.ring.visible = s.m === 2; o.ring.position.set(s.x, 0.06, s.y); o.ring.scale.setScalar(1.7 + Math.sin(t * 8) * 0.08)
      edge(s.x, STAR_H * 0.5, s.y, '#ffd84a')
    }
    for (const [id, o] of stars) if (!seen.has(id)) { o.d.forEach((q) => scene.remove(q.root)); scene.remove(o.ring); scene.remove(o.glow); stars.delete(id) }
    // 친구
    const used = new Set<number>()
    for (const p of f.players) {
      used.add(p.slot); const k = kid(p.slot)
      const moved = Math.hypot(p.x - k.px, p.y - k.pz) > 0.004; if (p.x - k.px) k.dir = p.x - k.px > 0 ? 1 : -1
      k.px = p.x; k.pz = p.y
      k.d.root.visible = true; k.d.root.position.set(p.x, 0, p.y)
      k.d.body.position.y = moved ? Math.abs(Math.sin(t * 9)) * 0.12 : 0
      w.face(k.d, k.dir)
      k.ring.visible = true; k.ring.position.set(p.x, 0.06, p.y)
      k.tag.visible = true; k.tag.position.set(p.x, 0.4, p.y + 1.5)
      k.arrow.visible = p.mine; k.arrow.position.set(p.x, AH * KA + 1.0 + Math.sin(t * 5) * 0.12, p.y)
      const text = p.say ?? ''
      if (text !== k.bubText) { k.bubText = text; k.bub.visible = !!text; if (text) { const m = k.bub.material; m.map?.dispose(); m.map = new THREE.CanvasTexture(bubbleCanvas(text)); m.map.colorSpace = THREE.SRGBColorSpace; m.needsUpdate = true } }
      k.bub.position.set(p.x, AH * KA + 2.0, p.y)
      if (p.mine) catchRing.position.set(p.x, 0.07, p.y); else edge(p.x, AH, p.y, SLOT_COLORS[p.slot])
    }
    kids.forEach((k, i) => { if (k && !used.has(i)) { k.d.root.visible = false; k.ring.visible = false; k.tag.visible = false; k.arrow.visible = false; k.bub.visible = false } })
    catchRing.visible = f.players.some((p) => p.mine)
    // 잡은 별: 폭죽이 터지고 별이 하늘로 올라간다. 헛손질은 둥근 물결
    let nd = 0, nr = 0, nb = 0
    for (const e of f.fx) {
      if (e.k === 'fly') {
        const d = (fxStar[nd] ??= w.paperDoll(starTex[0], STAR_H, starAspect[0])); nd++
        d.root.visible = true; d.root.position.set(e.x, 0, e.y)
        d.body.position.y = STAR_H * 0.5 + e.u * (f.calm ? 1.5 : 9); d.body.scale.setScalar(Math.max(0.05, f.calm ? 1 - e.u * 0.5 : 1 + e.u * 0.3 - e.u * e.u * 1.3)); w.face(d, 1)
        if (e.u < 0.45) {
          const b = (fxBurst[nb] ??= (() => { const sp = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ map: burstTex, transparent: true, depthWrite: false }))); sp.renderOrder = 9; scene.add(sp); return sp })()); nb++
          b.visible = true; b.position.set(e.x, STAR_H * 0.6, e.y + 0.3); const sc = STAR_H * (1.2 + e.u * 3.5); b.scale.set(sc, sc, 1); b.material.opacity = 1 - e.u / 0.45
        }
      } else {
        const r = (fxRing[nr] ??= mkRing(0xffffff, 0.8)); nr++
        r.visible = true; r.position.set(e.x, 0.08, e.y); r.scale.setScalar(0.5 + e.u * 1.3); (r.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - e.u)
      }
    }
    for (let i = nd; i < fxStar.length; i++) fxStar[i].root.visible = false
    for (let i = nr; i < fxRing.length; i++) fxRing[i].visible = false
    for (let i = nb; i < fxBurst.length; i++) fxBurst[i].visible = false
  }
  return out
}
