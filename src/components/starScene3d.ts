/**
 * 도망간 별을 잡아라 3D 무대: 카페·농장과 같은 풀밭 세계(createWorld)에 내 아바타(옷 입은 종이 인형)가 걷고,
 * 별은 얼굴 있는 별 그림이 통통 떠다닌다. 카메라는 위에서 비스듬히 내려다보는 고정 시점.
 * 규칙·판정은 하지 않고, 받은 좌표(필드 x,y → 세계 x,z)를 그리기만 한다.
 */
import * as THREE from 'three'
import { assetUrl } from '../lib/items'
import { CFG } from '../lib/starChase'
import { AVATAR_H, FEET, createWorld, type Doll, type World } from './world3d'

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
export interface StarScene { setLook(slot: number, cv: HTMLCanvasElement): void; frame(f: SceneFrame): void; dispose(): void }

function starCanvas(mode: number) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!; g.translate(128, 136)
  const r = 84
  g.shadowColor = 'rgba(255,225,110,.95)'; g.shadowBlur = mode === 2 ? 14 : 30
  g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.5 : r * 1.15; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) }
  g.closePath(); g.fillStyle = mode === 2 ? '#ffec80' : '#ffd84a'; g.fill(); g.shadowBlur = 0; g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = '#e8a91e'; g.stroke()
  g.fillStyle = '#6b3b1e'
  if (mode === 2) { g.beginPath(); g.arc(-r * 0.28, -2, r * 0.13, 0, 7); g.arc(r * 0.28, -2, r * 0.13, 0, 7); g.fill(); g.beginPath(); g.arc(0, r * 0.3, r * 0.12, 0, 7); g.fill() }
  else { g.lineWidth = 6; g.strokeStyle = '#6b3b1e'; g.beginPath(); g.arc(-r * 0.28, 0, r * 0.12, Math.PI * 1.1, Math.PI * 1.9); g.moveTo(r * 0.28 + r * 0.12, 0); g.arc(r * 0.28, 0, r * 0.12, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(0, r * 0.1, r * 0.2, 0.2, Math.PI - 0.2); g.stroke() }
  g.fillStyle = 'rgba(255,130,150,.65)'; g.beginPath(); g.arc(-r * 0.52, r * 0.22, r * 0.13, 0, 7); g.arc(r * 0.52, r * 0.22, r * 0.13, 0, 7); g.fill()
  if (mode >= 1) { g.fillStyle = '#c04a5a'; g.font = '900 64px sans-serif'; g.textAlign = 'center'; g.fillText('!', 0, -r * 1.2 + 10) } // 놀람 느낌표
  return c
}
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
function fieldCanvas(grass: HTMLImageElement | null) {
  const W = 1024, H = 768, c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  // 풀 무늬를 깔고 가장자리를 부드럽게 지운다(언덕 그림 위에 놓여도 경계가 튀지 않게)
  if (grass && grass.complete && grass.naturalWidth) { const pat = g.createPattern(grass, 'repeat'); if (pat) { pat.setTransform(new DOMMatrix().scale(0.32)); g.fillStyle = pat } } else g.fillStyle = '#6aa58a'
  g.fillRect(0, 0, W, H)
  g.globalCompositeOperation = 'destination-in'
  const m = g.createRadialGradient(W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.5); m.addColorStop(0, 'rgba(0,0,0,.9)'); m.addColorStop(1, 'rgba(0,0,0,0)')
  g.save(); g.translate(W / 2, H / 2); g.scale(W / H, 1); g.translate(-W / 2, -H / 2); g.fillStyle = m; g.fillRect(0, 0, W, H); g.restore()
  g.globalCompositeOperation = 'source-over'
  g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,.7)'; g.setLineDash([34, 26]); g.beginPath(); g.roundRect(W * 0.09, H * 0.09, W * 0.82, H * 0.82, 80); g.stroke()
  return c
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
  const w: World = createWorld(el, { bounds: 30, start: { x: 0, z: 0 }, seed: 11, grass: assetUrl('starchase/grass.webp'), bare: true })
  // 풀밭 무대: 뒤 배경(하늘·언덕 그림) 위에 얹힌다
  const grassImg = new Image(); grassImg.src = assetUrl('starchase/grass.webp')
  const fieldTex = new THREE.CanvasTexture(fieldCanvas(null)); fieldTex.colorSpace = THREE.SRGBColorSpace; w.keep(fieldTex)
  grassImg.onload = () => { fieldTex.image = fieldCanvas(grassImg); fieldTex.needsUpdate = true }
  const field = new THREE.Mesh(w.keep(new THREE.PlaneGeometry(CFG.w * 1.5, CFG.h * 1.5)), w.keep(new THREE.MeshBasicMaterial({ map: fieldTex, transparent: true, depthWrite: false })))
  field.rotation.x = -Math.PI / 2; field.position.y = 0.03; w.scene.add(field)

  const starTex = [0, 1, 2].map((m) => w.texOf(starCanvas(m)))
  const glowTex = w.texOf(glowCanvas())
  const stars = new Map<number, { d: Doll; ring: THREE.Mesh; glow: THREE.Sprite; x: number; z: number }>()
  const ringGeo = w.keep(new THREE.RingGeometry(0.9, 1.05, 40))
  const mkRing = (color: number, op: number) => { const m = new THREE.Mesh(ringGeo, w.keep(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }))); m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.renderOrder = 2; w.scene.add(m); return m }
  const starDoll = (m: number) => { const d = w.paperDoll(starTex[m], 1.5, 1); d.root.scale.setScalar(KS); return d }
  // 친구 인형(자리마다)
  const KS = 2.0, KA = 1.9 // 화면에서 잘 보이게 별·아바타를 조금 키운다
  const blank = document.createElement('canvas'); blank.width = 8; blank.height = 8
  type Kid = { d: Doll; ring: THREE.Mesh; tag: THREE.Sprite; arrow: THREE.Sprite; bub: THREE.Sprite; bubText: string; x: number; z: number; px: number; pz: number; dir: 1 | -1 }
  const kids: (Kid | null)[] = [null, null, null, null]
  const sprite = (cv: HTMLCanvasElement, sx: number, sy: number) => { const s = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ map: w.texOf(cv), transparent: true, depthWrite: false }))); s.scale.set(sx, sy, 1); s.renderOrder = 8; w.scene.add(s); return s }
  const kid = (slot: number): Kid => {
    let k = kids[slot]; if (k) return k
    const d = w.paperDoll(w.texOf(blank), AVATAR_H, 1024 / 1536, FEET); d.root.scale.setScalar(KA)
    const ring = mkRing(parseInt(SLOT_COLORS[slot].slice(1), 16), 0.95); ring.scale.set(0.9, 0.9, 0.9)
    const tag = sprite(glyphCanvas(SLOT_SHAPES[slot], SLOT_COLORS[slot]), 0.9, 0.9)
    const arrow = sprite(glyphCanvas('▼', SLOT_COLORS[slot]), 0.7, 0.7)
    const bub = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))); bub.scale.set(3.2, 0.96, 1); bub.renderOrder = 9; bub.visible = false; w.scene.add(bub)
    k = { d, ring, tag, arrow, bub, bubText: '', x: 0, z: 0, px: 99, pz: 99, dir: 1 }; kids[slot] = k; return k
  }
  const catchRing = new THREE.Mesh(w.keep(new THREE.PlaneGeometry(CFG.catchR * 2, CFG.catchR * 2)), w.keep(new THREE.MeshBasicMaterial({ map: w.texOf(zoneCanvas()), transparent: true, depthWrite: false }))); catchRing.rotation.x = -Math.PI / 2; catchRing.position.y = 0.05; catchRing.renderOrder = 2; w.scene.add(catchRing)
  const fxPool: Doll[] = [], fxRing: THREE.Mesh[] = []
  const t0 = performance.now()
  let pending: SceneFrame | null = null
  // 세계가 그리기 직전에 부른다(그래야 카메라를 우리가 정한 대로 둘 수 있다)
  w.onFrame(() => { if (pending) apply(pending) })

  return {
    setLook: (slot, cv) => { const m = kid(slot).d.doll.material as THREE.MeshBasicMaterial; m.map = w.texOf(cv); m.needsUpdate = true },
    frame: (f) => { pending = f },
    dispose: () => w.dispose(),
  }
  function apply(f: SceneFrame) {
    {
      // 카메라: 앞쪽 위에서 비스듬히(그림 속 구도). 필드가 화면 폭과 높이에 맞게 거리를 정한다
      const cam = w.camera, tanH = Math.tan((cam.fov * Math.PI) / 360), el = 0.95
      const D = Math.min(90, Math.max(((CFG.w + 2) / 2) / (tanH * cam.aspect * 0.95), ((CFG.h * Math.sin(el) + 1.5) / 2) / (tanH * 0.9)))
      cam.position.set(0, Math.sin(el) * D, 0.6 + Math.cos(el) * D); cam.lookAt(0, 0, 0.6)
      w.me.x = f.me.x; w.me.z = f.me.y // 나무 가림 처리가 내 자리를 보게
      const t = (f.now - t0) / 1000
      // 별
      const seen = new Set<number>()
      for (const s of f.stars) {
        seen.add(s.id)
        let o = stars.get(s.id)
        if (!o) { const d = starDoll(0); const glow = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))); glow.scale.set(5, 5, 1); glow.renderOrder = 3; w.scene.add(glow); o = { d, ring: mkRing(0xffffff, 0.9), glow, x: s.x, z: s.y }; stars.set(s.id, o) }
        const mat = o.d.doll.material as THREE.MeshBasicMaterial
        if (mat.map !== starTex[s.m]) { mat.map = starTex[s.m]; mat.needsUpdate = true }
        o.d.root.position.set(s.x, 0, s.y)
        o.d.body.position.y = 0.9 + (s.m === 2 ? Math.sin(t * 14) * 0.04 : Math.abs(Math.sin(t * 4 + s.id)) * 0.35)
        w.face(o.d, 1); o.d.body.rotation.x = -0.2
        o.glow.position.set(s.x, KS * (o.d.body.position.y + 0.7), s.y + 0.2); o.glow.material.opacity = s.m === 2 ? 0.55 : 0.9
        o.ring.visible = s.m === 2; o.ring.position.set(s.x, 0.06, s.y); o.ring.scale.setScalar(1.6 + Math.sin(t * 8) * 0.08)
      }
      for (const [id, o] of stars) if (!seen.has(id)) { w.scene.remove(o.d.root); w.scene.remove(o.ring); w.scene.remove(o.glow); stars.delete(id) }
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
        k.tag.visible = true; k.tag.position.set(p.x, 0.35, p.y + 1.25)
        k.arrow.visible = p.mine; k.arrow.position.set(p.x, AVATAR_H * KA + 1.15 + Math.sin(t * 5) * 0.12, p.y)
        const text = p.say ?? ''
        if (text !== k.bubText) { k.bubText = text; k.bub.visible = !!text; if (text) { const m = k.bub.material; m.map?.dispose(); m.map = new THREE.CanvasTexture(bubbleCanvas(text)); m.map.colorSpace = THREE.SRGBColorSpace; m.needsUpdate = true } }
        k.bub.position.set(p.x, AVATAR_H * KA + 2.1, p.y)
        if (p.mine) { catchRing.position.set(p.x, 0.07, p.y); catchRing.visible = true }
      }
      kids.forEach((k, i) => { if (k && !used.has(i)) { k.d.root.visible = false; k.ring.visible = false; k.tag.visible = false; k.arrow.visible = false; k.bub.visible = false } })
      if (!f.players.some((p) => p.mine)) catchRing.visible = false
      // 잡은 별이 하늘로 올라가고, 헛손질은 둥근 물결
      let nd = 0, nr = 0
      for (const e of f.fx) {
        if (e.k === 'fly') {
          const d = (fxPool[nd] ??= starDoll(0)); nd++
          d.root.visible = true; d.root.position.set(e.x, 0, e.y)
          d.body.position.y = 0.9 + e.u * (f.calm ? 1.5 : 7); d.body.scale.setScalar(Math.max(0.05, f.calm ? 1 - e.u * 0.5 : 1 + e.u * 0.3 - e.u * e.u * 1.2)); w.face(d, 1)
        } else {
          const r = (fxRing[nr] ??= mkRing(0xffffff, 0.8)); nr++
          r.visible = true; r.position.set(e.x, 0.08, e.y); r.scale.setScalar(0.5 + e.u * 1.3); (r.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - e.u)
        }
      }
      for (let i = nd; i < fxPool.length; i++) fxPool[i].root.visible = false
      for (let i = nr; i < fxRing.length; i++) fxRing[i].visible = false
    }
  }
}
