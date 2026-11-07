import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { avatarName, getAvatar } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import { findItem, isFound, travelFindable, travelItem } from '../lib/game'
import { ITEM_BY_ID, assetUrl } from '../lib/items'
import { getMeet, talkFor, type Talk } from '../lib/meet'
import { toggleItem } from '../lib/outfit'
import { playOrder, playServe, playTap } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { GuestDresser } from './GuestDresser'
import { ANIMAL_H, HOUSE_ART, TREE_ART, createWorld, emojiCanvas, type Doll, type World } from './world3d'

/**
 * 3D 산책 (시험판): 마을은 3D(길·나무·집·꽃·구름)이고, 아바타와 동물 친구는 지금 그림을 세운 '종이 인형'이다.
 * 땅을 누르면 그곳으로 걷고, 끌면 둘레를 돈다. 길에 반짝이(✨)가 있으면 가서 줍고, 친구를 누르면 다가가서 이야기한다.
 * 👗 버튼으로 그 자리에서 옷을 갈아입는다(코디 탭과 같은 옷).
 */
const WORLD = 70
const SPARKLES = 10

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function Walk3D({ outfit, tweaks, onOutfit, onExit }: { outfit: Outfit; tweaks: Tweaks; onOutfit: (next: Outfit) => void; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const world = useRef<World | null>(null)
  const [ready, setReady] = useState(false)
  const [got, setGot] = useState<string | null>(null)
  const [dressing, setDressing] = useState(false)
  /** 이야기: step 은 지금 묻는 질문, said 는 친구가 방금 한 답, done 이면 끝 */
  const [talk, setTalk] = useState<{ animal: number; t: Talk; step: 0 | 1; said: string | null; done: boolean } | null>(null)
  const talking = useRef<number | null>(null)
  talking.current = talk?.animal ?? null

  useEffect(() => { if (!got) return; const t = setTimeout(() => setGot(null), 4000); return () => clearTimeout(t) }, [got])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const friendOf = new Map<THREE.Object3D, number>()
    const friends: { animal: number; doll: Doll; x: number; z: number; tx: number; tz: number; wait: number; dir: 1 | -1; t: number }[] = []
    const w = createWorld(el, {
      bounds: WORLD, start: { x: 0, z: 0 }, yaw: Math.PI, grass: assetUrl('cafe/3d/grass.webp'), onReady: () => setReady(true),
      // 친구를 누르면 그 친구 앞까지 걸어가서 이야기를 시작한다
      onPick: (o) => {
        const k = friendOf.get(o)
        if (k === undefined || talking.current !== null) return
        const f = friends[k]
        w.walkTo(f.x, f.z, () => {
          playOrder()
          f.wait = 999
          talking.current = f.animal
          setTalk({ animal: f.animal, t: talkFor(f.animal, avatarName(getAvatar()), !getMeet().met.includes(f.animal)), step: 0, said: null, done: false })
        }, 1.8)
      },
    })
    world.current = w
    const { scene, rnd, keep, lambert } = w

    // 산책길: 구불구불한 흙길(카페 흙길 그림) + 길가 돌멩이
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => new THREE.Vector3(Math.sin(i * 1.3) * 9, 0, -WORLD + (i * WORLD * 2) / 8)))
    const samples = curve.getSpacedPoints(240)
    w.me.x = samples[20].x; w.me.z = samples[20].z
    const roadW = 3.4
    const pos: number[] = [], idx: number[] = [], uv: number[] = []
    let along = 0
    samples.forEach((p, i) => {
      const t = curve.getTangentAt(i / (samples.length - 1))
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(roadW / 2)
      pos.push(p.x + n.x, 0.02, p.z + n.z, p.x - n.x, 0.02, p.z - n.z)
      if (i) along += p.distanceTo(samples[i - 1])
      uv.push(0, along / roadW, 1, along / roadW) // 흙길 그림 한 장 = 길 폭만큼
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    })
    const roadGeo = keep(new THREE.BufferGeometry())
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    roadGeo.setIndex(idx)
    roadGeo.computeVertexNormals()
    const dirt = w.texOf(assetUrl('cafe/3d/dirt.webp'))
    dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping
    const road = new THREE.Mesh(roadGeo, keep(new THREE.MeshLambertMaterial({ map: dirt, side: THREE.DoubleSide })))
    road.receiveShadow = true
    scene.add(road)
    const stoneGeo = keep(new THREE.SphereGeometry(0.18, 8, 6)), stoneMat = lambert(0xe3e0d6)
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

    // 집: 길가에 여행 집 그림(물약 가게·보라 궁전·분홍 성·과자 집)
    ;[0.15, 0.38, 0.62, 0.85].forEach((u, k) => {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u)
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar((k % 2 ? 1 : -1) * 6.5)
      const art = HOUSE_ART[k % HOUSE_ART.length]
      w.addProp(art.img, p.x + n.x, p.z + n.z, 6, art.aspect, 2.5)
    })

    // 나무: 절반은 길가에, 나머지는 들판에
    let trees = 0
    for (let i = 0; i < 400 && trees < 110; i++) {
      const s0 = samples[Math.floor(rnd() * samples.length)], a = rnd() * Math.PI * 2, far = 6 + rnd() * 8
      const [x, z] = i % 2 ? [s0.x + Math.cos(a) * far, s0.z + Math.sin(a) * far] : [(rnd() - 0.5) * WORLD * 1.9, (rnd() - 0.5) * WORLD * 1.9]
      if (nearRoad(x, z, 4.5) || w.obstacles.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 9)) continue
      w.addTree(x, z, 0.8 + rnd() * 0.5, TREE_ART[Math.floor(rnd() * TREE_ART.length)])
      trees++
    }

    // 꽃: 납작한 꽃송이를 한꺼번에(InstancedMesh)
    const flowers = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 8)), keep(new THREE.MeshLambertMaterial({ color: 0xffffff })), 700)
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

    // 반짝이: 길 위 열 곳. 아직 못 찾은 여행 아이템이 늘 같은 자리에 숨어 있다(찾으면 사라진다)
    const pool = travelFindable().sort((a, b) => (a.id < b.id ? -1 : 1))
    const sparkTex = w.texOf(emojiCanvas('✨'))
    const sparks: { id: string; sprite: THREE.Sprite; x: number; z: number; t: number }[] = []
    for (let k = 0; k < SPARKLES && pool.length; k++) {
      const item = pool[hash(`walk3d${k}`) % pool.length]
      if (isFound(item.id) || sparks.some((s) => s.id === item.id)) continue
      const s = samples[27 + k * 20]
      const sprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false })))
      const x = s.x + ((k % 3) - 1) * 0.9, z = s.z
      sprite.position.set(x, 0.7, z)
      sprite.scale.setScalar(1.4)
      scene.add(sprite)
      sparks.push({ id: item.id, sprite, x, z, t: k })
    }

    // 동물 친구 넷: 근처를 거닐다 쉬었다 한다. 누르면 이야기
    ;[0, 2, 4, 6].forEach((animal, k) => {
      const doll = w.paperDoll(w.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[animal].img}_stand.webp`)), ANIMAL_H, 1)
      const s = samples[30 + k * 25]
      friendOf.set(doll.root, k)
      w.pickables.push(doll.root)
      const x = s.x + (k % 2 ? 2.2 : -2.2)
      friends.push({ animal, doll, x, z: s.z, tx: x, tz: s.z, wait: rnd() * 2, dir: 1, t: rnd() * 5 })
    })

    w.onFrame((dt, now) => {
      for (const f of friends) {
        f.t += dt
        const busy = talking.current === f.animal
        if (busy) f.dir = w.me.x < f.x ? -1 : 1
        else if (f.wait > 0) f.wait = Math.min(f.wait, 5) - dt
        else {
          const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz)
          if (d < 0.1) {
            f.wait = 1.5 + rnd() * 3
            const s = samples[Math.floor(rnd() * samples.length)]
            const near = Math.hypot(s.x - w.me.x, s.z - w.me.z) < 18 ? s : { x: w.me.x + (rnd() - 0.5) * 10, z: w.me.z + (rnd() - 0.5) * 10 }
            f.tx = near.x + (rnd() - 0.5) * 3; f.tz = near.z + (rnd() - 0.5) * 3
          } else {
            f.x += (dx / d) * 2.3 * dt; f.z += (dz / d) * 2.3 * dt
            const side = w.screenSide(dx, dz)
            if (Math.abs(side) > 0.05) f.dir = side > 0 ? 1 : -1
            w.pushOut(f, 0.35)
          }
        }
        // 아바타와 겹치지 않게 살짝 비켜 선다
        const ax = f.x - w.me.x, az = f.z - w.me.z, ad = Math.hypot(ax, az)
        if (ad < 1.3 && ad > 1e-3) { f.x = w.me.x + (ax / ad) * 1.3; f.z = w.me.z + (az / ad) * 1.3 }
        f.doll.root.position.set(f.x, 0, f.z)
        f.doll.body.position.y = f.wait > 0 || busy ? 0 : Math.abs(Math.sin(f.t * 8)) * 0.1
        w.face(f.doll, f.dir)
      }
      // 반짝이: 통통 뜨고, 아바타가 닿으면 줍는다
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.sprite.position.y = 0.9 + Math.sin(now / 300 + s.t) * 0.15
        s.sprite.material.rotation = Math.sin(now / 500 + s.t) * 0.3
        if (Math.hypot(w.me.x - s.x, w.me.z - s.z) < 1.2) {
          scene.remove(s.sprite)
          sparks.splice(i, 1)
          if (findItem(s.id)) { playServe(); setGot(s.id) }
        }
      }
    })
    return () => { w.dispose(); world.current = null }
  }, [])

  // 옷이 바뀌면 아바타 그림을 다시 그려 판에 붙인다
  useEffect(() => {
    let alive = true
    renderFigure(outfit, tweaks).then((cv) => { if (alive) world.current?.setAvatar(cv) }).catch(() => setReady(true))
    return () => { alive = false }
  }, [outfit, tweaks])

  const endTalk = () => {
    // 이야기를 마친 친구는 잠깐 쉬었다가 다시 거닌다
    setTalk(null)
    talking.current = null
  }
  const gotItem = got ? travelItem(got) : undefined
  const wearable = got ? ITEM_BY_ID[got] : undefined
  const a = talk ? CALL_ANIMALS[talk.animal] : null

  return (
    <section aria-label="3D 산책" className="relative h-full overflow-hidden rounded-3xl bg-[#bfe6ff] select-none">
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#3d6b2f] shadow">🌳 3D 산책 <span className="text-xs font-bold text-black/40">시험판</span></span>
        <div className="pointer-events-auto flex gap-1.5">
          <button aria-label="옷 갈아입기" onClick={() => { playTap(); setDressing(true) }} className="h-10 rounded-full bg-white/95 px-3 text-sm font-black text-[#8a4b55] shadow">👗 옷</button>
          <button aria-label="닫기" onClick={onExit} className="h-10 w-10 rounded-full bg-white/95 text-lg font-bold shadow">✕</button>
        </div>
      </div>
      {!talk && <p className="pointer-events-none absolute inset-x-2 bottom-3 z-10 m-0 text-center text-xs font-bold text-[#3d6b2f] drop-shadow-[0_1px_0_white]">땅을 누르면 걸어가요 · 옆으로 끌면 둘러봐요 · ✨ 줍고, 친구를 누르면 이야기해요</p>}
      {!ready && <p className="absolute inset-0 z-20 m-0 flex items-center justify-center text-sm font-bold text-[#3d6b2f]">마을을 만드는 중…</p>}

      {gotItem && (
        <div role="status" className="absolute top-14 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-lg">
          <img src={assetUrl(gotItem.thumb)} alt="" className="h-12 w-12 object-contain" />
          <span className="text-sm font-bold whitespace-nowrap">찾았어요! {gotItem.name.ko}</span>
          {wearable && <button onClick={() => { playTap(); onOutfit(toggleItem(outfit, wearable)); setGot(null) }} className="min-h-9 shrink-0 rounded-full bg-[#ff8fab] px-3 text-sm font-bold text-white">입어 보기</button>}
        </div>
      )}

      {talk && a && (
        <div role="dialog" aria-label={`${a.name}랑 이야기`} className="absolute inset-x-2 bottom-3 z-30 mx-auto flex max-w-md flex-col gap-2 rounded-3xl bg-white/95 p-3 shadow-xl">
          <div className="flex items-start gap-2">
            <img src={assetUrl(`cafe/face/${a.img}.webp`)} alt="" draggable={false} className="h-14 w-14 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="m-0 text-xs font-bold text-[#c06a7d]">{a.name}</p>
              <p className="m-0 text-base leading-snug font-bold text-[#6b4b52]">{talk.done ? talk.said : `${talk.said ?? talk.t.hello} ${talk.t.asks[talk.step].ask}`}</p>
            </div>
          </div>
          {!talk.done ? (
            <div className="flex flex-wrap justify-end gap-2">
              {talk.t.asks[talk.step].replies.map((rp) => <button key={rp.label} onClick={() => { playTap(); setTalk(talk.step === 0 ? { ...talk, step: 1, said: rp.answer } : { ...talk, said: rp.answer, done: true }) }}
                className="min-h-11 rounded-full bg-[#ffe1ea] px-4 text-sm font-bold text-[#8a4b55] shadow-sm">{rp.label}</button>)}
            </div>
          ) : (
            <button onClick={() => { playServe(); endTalk() }} className="min-h-11 self-end rounded-full bg-[#ff8fab] px-5 text-sm font-bold text-white shadow">👋 안녕~ 또 만나!</button>
          )}
        </div>
      )}

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
