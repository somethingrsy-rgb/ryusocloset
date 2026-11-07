import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { getAvatar } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import { CROPS, MAIN_PLOTS, PLOT_COUNT, actFarm, getFarm, growth, subscribeFarm, type CropId, type FarmAction } from '../lib/farm'
import { getFarmFriends } from '../lib/farmFriends'
import { assetUrl } from '../lib/items'
import { guestAvatar } from '../lib/party'
import { guestLook } from '../lib/guestLooks'
import { playHarvest, playPlant, playTap, playWater } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { CoinIcon } from './Icons'
import { GuestDresser } from './GuestDresser'
import { ANIMAL_H, AVATAR_H, FEET, createWorld, emojiCanvas, type Doll, type World } from './world3d'

/**
 * 3D 농장 (시험판): 큰 밭 20칸과 옆 울타리 밭 8칸(농장 탭과 같은 밭·같은 저장)을 3D 들판에 깔고, 아바타가 걸어가서 심고·물 주고·수확한다.
 * 밭을 누르면 그 밭이 필요로 하는 일(심기 → 물주기 → 다 자라면 수확)을 한다. 작물은 농장 그림을 세운 종이 인형.
 * 같이 농사짓는 동물 친구는 밭 둘레를 거닌다(물 주기는 농장 탭처럼 친구들이 따로 한다).
 */
const COLS = 5, ROWS = 4
const PW = 2.6, PD = 2.0, GAP = 0.7
const BOUNDS = 40
/** 옆 울타리 밭(20~27번): 큰 밭 오른쪽 옆 땅에 4칸×2줄 */
const SIDE_COLS = 4
const SIDE_X = (COLS * (PW + GAP)) / 2 + 1.2 + 4 + (SIDE_COLS * (PW + GAP)) / 2 + 1.2
/** 작물 그림 크기(가로·세로 px) */
const CROP_BOX: Record<CropId, [number, number]> = { carrot: [568, 499], strawberry: [578, 453], corn: [505, 619] }
const stageOf = (wateredAt: number | null, progress: number) => (wateredAt === null ? 1 : progress >= 1 ? 4 : progress < 0.4 ? 2 : 3)
/** 밭 자리: 처음부터 내 밭인 앞 칸(0~8)이 들어오는 문(앞쪽, +z) 가까이 오게 줄 번호가 클수록 뒤로 */
const plotAt = (i: number) => {
  if (i >= MAIN_PLOTS) { const j = i - MAIN_PLOTS; return { x: SIDE_X + ((j % SIDE_COLS) - (SIDE_COLS - 1) / 2) * (PW + GAP), z: -(Math.floor(j / SIDE_COLS) - 0.5) * (PD + GAP) - 4 } }
  return { x: ((i % COLS) - (COLS - 1) / 2) * (PW + GAP), z: -(Math.floor(i / COLS) - (ROWS - 1) / 2) * (PD + GAP) - 4 }
}

export function Farm3D({ outfit, tweaks, onOutfit, onExit }: { outfit: Outfit; tweaks: Tweaks; onOutfit: (next: Outfit) => void; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const world = useRef<World | null>(null)
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [ready, setReady] = useState(false)
  const [seed, setSeed] = useState<CropId>('strawberry')
  const seedRef = useRef(seed)
  seedRef.current = seed
  const [notice, setNotice] = useState<string | null>(null)
  const [dressing, setDressing] = useState(false)
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 2200); return () => clearTimeout(t) }, [notice])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const plotOf = new Map<THREE.Object3D, number>()
    const busy = new Set<number>()
    const apply = (a: FarmAction) => {
      if (actFarm(a) !== 'saved') return
      if (a.type === 'plant') playPlant()
      else if (a.type === 'water') playWater()
      else if (a.type === 'harvest') playHarvest()
    }
    const w = createWorld(el, {
      bounds: BOUNDS, start: { x: 0, z: 6 }, seed: 11, grass: assetUrl('cafe/3d/grass.webp'), onReady: () => setReady(true),
      // 밭을 누르면 밭 앞까지 걸어가서 그 밭이 필요로 하는 일을 한다
      onPick: (o) => {
        const i = plotOf.get(o)
        if (i === undefined || busy.has(i)) return
        const st = getFarm()
        if (!st.owned[i]) { setNotice(i >= MAIN_PLOTS ? '옆 밭은 농장 탭의 「옆 밭」에서 코인으로 살 수 있어요' : '이 밭은 아직 내 밭이 아니에요 · 농장 탭에서 살 수 있어요'); return }
        const plot = st.plots[i]
        const need = !plot ? 'seed' : plot.wateredAt === null ? 'water' : growth(plot, Date.now()) === 1 ? 'harvest' : null
        if (!need) { setNotice('자라는 중이에요 🌱'); return }
        busy.add(i)
        const p = plotAt(i)
        w.walkTo(p.x, p.z + PD / 2 + 0.6, () => {
          window.setTimeout(() => {
            busy.delete(i)
            if (need === 'seed') apply({ type: 'plant', plot: i, crop: seedRef.current })
            else if (need === 'water') apply({ type: 'water', plot: i })
            else apply({ type: 'harvest', plot: i })
          }, 250)
        }, 0.3)
      },
    })
    world.current = w
    const { scene, rnd, keep, lambert } = w

    // 밭 20칸: 흙 상자(마른 흙·젖은 흙·아직 못 산 밭은 풀빛) + 작물 둘 + 표시(💧 물 필요, ✨ 다 자람, 🔒 잠김)
    const boxGeo = keep(new THREE.BoxGeometry(PW, 0.22, PD))
    const ridgeGeo = keep(new THREE.BoxGeometry(PW * 0.92, 0.08, 0.16))
    const dryMat = lambert(0xc4935f), wetMat = lambert(0x7d5234), lockedMat = lambert(0xa9cf86), ridgeDry = lambert(0xb07e4c), ridgeWet = lambert(0x6a4329)
    const icon = (s: string) => keep(new THREE.SpriteMaterial({ map: w.texOf(emojiCanvas(s)), transparent: true, depthWrite: false }))
    const iconMats = { water: icon('💧'), ready: icon('✨'), lock: icon('🔒') }
    const cropTex = new Map<string, THREE.Texture>()
    const texFor = (crop: CropId, stage: number) => {
      const k = `${crop}_${stage}`
      if (!cropTex.has(k)) cropTex.set(k, w.texOf(assetUrl(`assets/farm/${k}.webp`)))
      return cropTex.get(k)!
    }
    const plots = Array.from({ length: PLOT_COUNT }, (_, i) => {
      const p = plotAt(i)
      const box = new THREE.Mesh(boxGeo, dryMat)
      box.position.set(p.x, 0.11, p.z)
      box.receiveShadow = true
      const ridges = [-0.5, 0, 0.5].map((dz) => { const r = new THREE.Mesh(ridgeGeo, ridgeDry); r.position.set(p.x, 0.25, p.z + dz); scene.add(r); return r })
      scene.add(box)
      plotOf.set(box, i)
      w.pickables.push(box)
      const crops = [-0.6, 0.6].map((dx) => {
        const d = w.paperDoll(texFor('strawberry', 1), 1, 1)
        d.root.position.set(p.x + dx, 0.22, p.z)
        d.root.visible = false
        return d
      })
      const mark = new THREE.Sprite(iconMats.water)
      mark.position.set(p.x, 1.6, p.z)
      mark.scale.setScalar(0.6)
      mark.visible = false
      scene.add(mark)
      return { box, ridges, crops, mark, key: '' }
    })
    // 지금 밭 상태대로 다시 칠한다(바뀐 칸만)
    const paint = () => {
      const st = getFarm(), now = Date.now()
      plots.forEach((v, i) => {
        const plot = st.plots[i], prog = growth(plot, now)
        const stage = plot ? stageOf(plot.wateredAt, prog) : 0
        const key = `${st.owned[i]}|${plot?.crop}|${stage}|${plot?.wateredAt === null}`
        if (key === v.key) return
        v.key = key
        const wet = !!plot && plot.wateredAt !== null && prog < 1
        v.box.material = !st.owned[i] ? lockedMat : wet ? wetMat : dryMat
        for (const r of v.ridges) { r.visible = st.owned[i]; r.material = wet ? ridgeWet : ridgeDry }
        for (const c of v.crops) {
          c.root.visible = !!plot
          if (plot) {
            const [bw, bh] = CROP_BOX[plot.crop], h = (plot.crop === 'corn' ? 1.9 : 1.5) * (stage === 1 ? 0.75 : stage === 2 ? 0.85 : 1)
            const m = c.doll.material as THREE.MeshBasicMaterial
            m.map = texFor(plot.crop, stage)
            m.needsUpdate = true
            c.body.scale.set((h * bw) / bh, h, 1) // 판 크기는 body 에(face 가 doll 의 좌우를 바꾼다)
          }
        }
        v.mark.visible = !st.owned[i] || (!!plot && (plot.wateredAt === null || prog >= 1))
        v.mark.material = !st.owned[i] ? iconMats.lock : plot && prog >= 1 ? iconMats.ready : iconMats.water
        v.mark.scale.setScalar(st.owned[i] ? 0.6 : 0.35)
      })
    }
    paint()
    const unsub = subscribeFarm(paint)

    // 울타리: 밭 둘레에 나무 기둥과 가로대
    const fx = (COLS * (PW + GAP)) / 2 + 1.2, fz0 = -4 - (ROWS * (PD + GAP)) / 2 - 1.2, fz1 = -4 + (ROWS * (PD + GAP)) / 2 + 1.2
    const postGeo = keep(new THREE.BoxGeometry(0.18, 1, 0.18)), postMat = lambert(0xfff6e8)
    const railGeo = keep(new THREE.BoxGeometry(1, 0.12, 0.08))
    const fenceLine = (x0: number, z0: number, x1: number, z1: number, gapAt?: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 1.6)
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t
        if (gapAt !== undefined && Math.abs(x - gapAt) < 2.2) continue // 들어가는 문
        const post = new THREE.Mesh(postGeo, postMat)
        post.position.set(x, 0.5, z)
        post.castShadow = true
        scene.add(post)
        if (k < n && !(gapAt !== undefined && Math.abs(x + (x1 - x0) / n - gapAt) < 2.2)) for (const y of [0.35, 0.75]) {
          const rail = new THREE.Mesh(railGeo, postMat)
          rail.scale.x = len / n
          rail.position.set(x + (x1 - x0) / n / 2, y, z + (z1 - z0) / n / 2)
          rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0)
          scene.add(rail)
        }
      }
    }
    fenceLine(-fx, fz0, fx, fz0); fenceLine(-fx, fz1, fx, fz1, 0); fenceLine(-fx, fz0, -fx, fz1); fenceLine(fx, fz0, fx, fz1)
    // 옆 울타리 밭 울타리(앞에 문)
    const sx0 = SIDE_X - (SIDE_COLS * (PW + GAP)) / 2 - 1.2, sx1 = SIDE_X + (SIDE_COLS * (PW + GAP)) / 2 + 1.2
    const sz0 = -4 - (PD + GAP) - 1.2, sz1 = -4 + (PD + GAP) + 1.2
    fenceLine(sx0, sz0, sx1, sz0); fenceLine(sx0, sz1, sx1, sz1, SIDE_X); fenceLine(sx0, sz0, sx0, sz1); fenceLine(sx1, sz0, sx1, sz1)

    // 빨간 헛간과 노점, 나무
    const barn = new THREE.Group()
    const bWall = new THREE.Mesh(keep(new THREE.BoxGeometry(5, 3.4, 4)), lambert(0xd84a3c))
    bWall.position.y = 1.7
    const bRoof = new THREE.Mesh(keep(new THREE.CylinderGeometry(2.2, 2.2, 5.2, 4, 1, false, Math.PI / 4)), lambert(0x8a3b30))
    bRoof.rotation.z = Math.PI / 2
    bRoof.scale.set(1, 1, 0.75)
    bRoof.position.y = 3.4
    const bDoor = new THREE.Mesh(keep(new THREE.BoxGeometry(1.8, 2.2, 0.1)), lambert(0xfff6e8))
    bDoor.position.set(0, 1.1, 2.02)
    for (const m of [bWall, bRoof]) { m.castShadow = true; m.receiveShadow = true }
    barn.add(bWall, bRoof, bDoor)
    barn.position.set(-fx - 5, 0, -6)
    barn.rotation.y = Math.PI / 2
    scene.add(barn)
    w.obstacles.push({ x: barn.position.x, z: barn.position.z, r: 3 })
    // 나무: 카페와 같은 3D 나무 그림(world3d.addTree)
    let trees = 0
    for (let i = 0; i < 300 && trees < 60; i++) {
      const x = (rnd() - 0.5) * BOUNDS * 1.9, z = (rnd() - 0.5) * BOUNDS * 1.9
      if (x > -fx - 4 && x < sx1 + 4 && z > fz0 - 4 && z < fz1 + 6) continue
      if (w.obstacles.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 10)) continue
      w.addTree(x, z, 0.8 + rnd() * 0.7)
      trees++
    }

    // 같이 농사짓는 친구(농장 탭에서 고른 친구): 밭 둘레를 거닌다. 아바타 친구는 고른 옷을 입은 아바타
    const friends: { doll: Doll; x: number; z: number; tx: number; tz: number; wait: number; dir: 1 | -1; t: number }[] = []
    getFarmFriends().forEach((g, k) => {
      const av = guestAvatar(g)
      const x = k ? fx - 1 : -fx + 1, z = fz1 + 1.5
      const f = { doll: null as unknown as Doll, x, z, tx: x, tz: z, wait: rnd() * 2, dir: 1 as 1 | -1, t: 0 }
      if (av) {
        // 아바타 친구 그림은 옷을 합쳐 그린 뒤에 붙인다(그 전에는 빈 판)
        f.doll = w.paperDoll(w.texOf(document.createElement('canvas')), AVATAR_H, 1024 / 1536, FEET)
        renderFigure(guestLook(av.id), {}, av).then((cv) => { const m = f.doll.doll.material as THREE.MeshBasicMaterial; m.map = w.texOf(cv); m.needsUpdate = true }).catch(() => {})
      } else f.doll = w.paperDoll(w.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[g].img}_stand.webp`)), ANIMAL_H, 1)
      friends.push(f)
    })

    let repaint = 0
    w.onFrame((dt) => {
      repaint += dt
      if (repaint > 0.5) { repaint = 0; paint() } // 자라는 단계는 시간이 지나면 바뀐다
      for (const p of plots) if (p.mark.visible) p.mark.position.y = (p.mark.material === iconMats.lock ? 0.6 : 1.6) + Math.sin(performance.now() / 300 + p.box.position.x) * 0.12
      for (const f of friends) {
        f.t += dt
        if (f.wait > 0) f.wait -= dt
        else {
          const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz)
          if (d < 0.1) {
            f.wait = 1.5 + rnd() * 3
            const side = Math.floor(rnd() * 4)
            f.tx = side < 2 ? (rnd() - 0.5) * fx * 2 : (side === 2 ? -fx : fx) + (side === 2 ? 0.9 : -0.9)
            f.tz = side < 2 ? (side ? fz1 - 0.9 : fz0 + 0.9) : fz0 + rnd() * (fz1 - fz0)
          } else {
            f.x += (dx / d) * 2.2 * dt; f.z += (dz / d) * 2.2 * dt
            const s = w.screenSide(dx, dz)
            if (Math.abs(s) > 0.05) f.dir = s > 0 ? 1 : -1
          }
        }
        f.doll.root.position.set(f.x, 0, f.z)
        f.doll.body.position.y = f.wait > 0 ? 0 : Math.abs(Math.sin(f.t * 8)) * 0.1
        w.face(f.doll, f.dir)
      }
      for (const p of plots) for (const c of p.crops) if (c.root.visible) w.face(c, 1)
    })
    return () => { unsub(); w.dispose(); world.current = null }
  }, [])

  useEffect(() => {
    let alive = true
    renderFigure(outfit, tweaks).then((cv) => { if (alive) world.current?.setAvatar(cv) }).catch(() => setReady(true))
    return () => { alive = false }
  }, [outfit, tweaks])

  return (
    <section aria-label="3D 농장" className="relative h-full overflow-hidden rounded-3xl bg-[#bfe6ff] select-none">
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start justify-between gap-2">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#3d6b2f] shadow">🌱 3D 농장 <span className="text-xs font-bold text-black/40">시험판</span></span>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <span className="rounded-full bg-white/95 px-3 py-2 text-sm font-black shadow"><CoinIcon /> {farm.coins}</span>
          <button aria-label="옷 갈아입기" onClick={() => { playTap(); setDressing(true) }} className="h-10 rounded-full bg-white/95 px-3 text-sm font-black text-[#8a4b55] shadow">👗 옷</button>
          <button aria-label="닫기" onClick={onExit} className="h-10 w-10 rounded-full bg-white/95 text-lg font-bold shadow">✕</button>
        </div>
      </div>
      {/* 심을 씨앗 고르기 */}
      <div role="radiogroup" aria-label="심을 씨앗" className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-white/90 p-1.5 shadow">
        {CROPS.map((c) => (
          <button key={c.id} role="radio" aria-checked={seed === c.id} aria-label={`${c.ko} 씨앗`} onClick={() => { playTap(); setSeed(c.id) }}
            className={`flex h-11 items-center gap-1 rounded-full px-3 text-sm font-black ${seed === c.id ? 'bg-[#ff8fab] text-white' : 'text-[#6b4a2b]'}`}>
            <img src={assetUrl(`assets/farm/harvest_${c.id}.webp`)} alt="" className="h-7 w-7 object-contain" />{c.ko}
          </button>
        ))}
      </div>
      <p className="pointer-events-none absolute inset-x-2 bottom-3 z-10 m-0 text-center text-xs font-bold text-[#3d6b2f] drop-shadow-[0_1px_0_white]">밭을 누르면 심고 · 💧 물 주고 · ✨ 수확해요 · 옆으로 끌면 둘러봐요</p>
      {notice && <p role="status" className="absolute top-14 left-1/2 z-20 m-0 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-center text-sm font-bold whitespace-nowrap shadow">{notice}</p>}
      {!ready && <p className="absolute inset-0 z-20 m-0 flex items-center justify-center text-sm font-bold text-[#3d6b2f]">농장을 만드는 중…</p>}
      {dressing && (
        <div role="dialog" aria-label="옷 갈아입기" className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-3" onClick={(e) => { if (e.target === e.currentTarget) setDressing(false) }}>
          <div className="sheet-in flex max-h-full w-full max-w-md flex-col rounded-3xl bg-[#fff8fb] p-4 shadow-2xl" style={{ height: 'min(560px, 100%)' }}>
            <GuestDresser avatar={getAvatar()} initial={outfit} invited={false} title="옷 갈아입기" doneLabel="✓ 이 옷 입기"
              onBack={() => setDressing(false)} onUninvite={() => setDressing(false)}
              onDone={(o) => { onOutfit(o); setDressing(false) }} />
          </div>
        </div>
      )}
    </section>
  )
}
