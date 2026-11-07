import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { renderFigure } from '../lib/exportPng'
import { guestLook } from '../lib/guestLooks'
import { assetUrl } from '../lib/items'
import { guestAvatar } from '../lib/party'
import { PLAYER_H, friendHop, visible, type RunState } from '../lib/runner'
import type { Outfit, Tweaks } from '../lib/types'
import { createStage, emojiCanvas, type Doll } from './stage3d'

/**
 * 달리기 3D 무대(시험판): 달리기·점프·장애물·별·선물 상자·하트는 원래 달리기 그대로(lib/runner), 그림만 3D 로 그린다.
 * 길은 앞(-z)으로 뻗고 카메라는 비스듬히 옆에서 본다(달리는 쪽 = 화면 오른쪽). 장애물·별·선물·아바타·친구는 종이 인형.
 */
const U = 1 / 60 // 달리기 1px = 1/60 장면 단위
const GROW = 1.25 // 장애물·아바타 그림을 2D 처럼 조금 크게
const CHUNK = 24

export function Runner3D({ live, outfit, tweaks, friends }: { live: MutableRefObject<RunState>; outfit: Outfit; tweaks: Tweaks; friends: number[] }) {
  const host = useRef<HTMLDivElement>(null)
  const avatarCanvas = useRef<HTMLCanvasElement | null>(null)
  const setAvatar = useRef<(cv: HTMLCanvasElement) => void>(() => {})
  useEffect(() => {
    let alive = true
    renderFigure(outfit, tweaks).then((cv) => { if (!alive) return; avatarCanvas.current = cv; setAvatar.current(cv) }).catch(() => {})
    return () => { alive = false }
  }, [outfit, tweaks])

  const friendKey = friends.join()
  useEffect(() => {
    const el = host.current
    if (!el) return
    const s = createStage(el, { sky: 0x9fd6ff, fog: [30, 70], view: { yaw: 1.05, pitch: 0.28, dist: 11, target: [0, 1.4, 0] }, fov: (w, h) => (w < h ? 62 : 42) })
    const { scene, keep, lambert } = s

    // 땅·길은 아바타를 따라 움직이는 큰 판, 길가 나무·꽃·돌은 구간마다 만들고 지나가면 지운다
    // 카페와 같은 잔디·흙길 그림
    const grassTex = s.texOf(assetUrl('cafe/3d/grass.webp'))
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping
    grassTex.repeat.set(25, 25)
    const dirtTex = s.texOf(assetUrl('cafe/3d/dirt.webp'))
    dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping
    dirtTex.repeat.set(1, 200 / 3.4)
    const grass = new THREE.Mesh(keep(new THREE.PlaneGeometry(200, 200)), keep(new THREE.MeshLambertMaterial({ map: grassTex })))
    grass.rotation.x = -Math.PI / 2
    grass.receiveShadow = true
    scene.add(grass)
    const road = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.4, 200)), keep(new THREE.MeshLambertMaterial({ map: dirtTex })))
    road.rotation.x = -Math.PI / 2
    road.position.y = 0.01
    road.receiveShadow = true
    scene.add(road)
    const stoneGeo = keep(new THREE.SphereGeometry(0.16, 8, 6)), stoneMat = lambert(0xe3e0d6)
    const flowerGeo = keep(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8))
    const flowerMats = [0xff8fb1, 0xffd54a, 0xffffff, 0xc7a6ff].map(lambert)
    const chunks = new Map<number, THREE.Group>()
    const treeTex = s.texOf(assetUrl('cafe/3d/tree.webp'))
    const makeChunk = (c: number) => {
      const g = new THREE.Group()
      const z0 = -c * CHUNK
      let h = (c * 2654435761) >>> 0
      const r = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296 }
      for (let k = 0; k < 12; k++) {
        const st = new THREE.Mesh(stoneGeo, stoneMat)
        st.position.set(k % 2 ? 1.85 : -1.85, 0.05, z0 - (k / 12) * CHUNK)
        st.scale.set(1, 0.6, 1)
        g.add(st)
      }
      for (let k = 0; k < 40; k++) {
        const f = new THREE.Mesh(flowerGeo, flowerMats[k % 4])
        const side = r() < 0.5 ? -1 : 1
        f.position.set(side * (2.3 + r() * 6), 0.03, z0 - r() * CHUNK)
        g.add(f)
      }
      scene.add(g)
      for (let k = 0; k < 7; k++) {
        // 카메라 쪽(+x)에는 나무를 두지 않는다(아바타를 가린다)
        // 카페와 같은 3D 나무 그림(늘 카메라를 본다)
        const t = s.paperDoll(treeTex, 4.2 * (0.8 + r() * 0.6), 951 / 1024)
        t.root.position.set(-(4 + r() * 10), 0, z0 - r() * CHUNK)
        g.add(t.root) // 나무도 이 구간 묶음에 넣어 같이 지운다
        g.userData.trees = [...(g.userData.trees ?? []), t]
      }
      chunks.set(c, g)
    }

    // 종이 인형: 아바타, 같이 달리는 친구(동물 또는 아바타 친구)
    const ah = PLAYER_H * GROW * U * 1.15
    const me: Doll = s.paperDoll(null, ah, 1024 / 1536, 1504 / 1536)
    setAvatar.current = (cv) => s.setMap(me, s.texOf(cv))
    if (avatarCanvas.current) setAvatar.current(avatarCanvas.current)
    const pals = friends.map((g) => {
      const av = guestAvatar(g)
      if (av) {
        const d = s.paperDoll(null, ah, 1024 / 1536, 1504 / 1536)
        renderFigure(guestLook(av.id), {}, av).then((cv) => s.setMap(d, s.texOf(cv))).catch(() => {})
        return d
      }
      return s.paperDoll(s.texOf(assetUrl(`cafe/stand/${CALL_ANIMALS[g].img}_stand.webp`)), ah * 0.55, 1)
    })

    // 장애물·별·선물: 지금 보이는 구간에 있는 것만 판으로 만들고, 지나가거나 먹으면 지운다
    const obTex = new Map<string, THREE.Texture>()
    const texFor = (img: string) => { if (!obTex.has(img)) obTex.set(img, s.texOf(assetUrl(`assets/runner/${img}.webp`))); return obTex.get(img)! }
    const starMat = keep(new THREE.SpriteMaterial({ map: s.texOf(emojiCanvas('⭐')) }))
    const giftMat = keep(new THREE.SpriteMaterial({ map: s.texOf(assetUrl('assets/runner/gift.webp')) }))
    const shown = new Map<string, THREE.Object3D>()

    let t = 0
    s.onFrame((dt) => {
      t += dt
      const run = live.current
      const pz = -run.x * U
      // 구간
      const c0 = Math.floor(run.x * U / CHUNK)
      for (let c = c0 - 1; c <= c0 + 3; c++) if (!chunks.has(c)) makeChunk(c)
      for (const [c, g] of chunks) if (c < c0 - 1 || c > c0 + 3) { scene.remove(g); chunks.delete(c) }
      for (const g of chunks.values()) for (const d of (g.userData.trees ?? []) as Doll[]) s.face(d)
      grass.position.z = pz; road.position.z = pz - 60
      // 판은 아바타를 따라가니 무늬는 반대로 밀어서 땅에 붙어 있게 한다
      grassTex.offset.y = -pz / 8; dirtTex.offset.y = -pz / 3.4
      // 보이는 것
      const { obstacles, coins, gifts } = visible(run.seed, run.x - 300, run.x + 2600, run.level, run.k)
      const want = new Set<string>()
      for (const o of obstacles) {
        const k = `o${o.id}`
        want.add(k)
        if (!shown.has(k)) {
          const d = s.paperDoll(texFor(o.img), o.h * GROW * U, o.dw / o.h, 1)
          d.root.position.set(0, 0, -o.x * U)
          shown.set(k, d.root)
          d.root.userData.doll = d
        }
        s.face(shown.get(k)!.userData.doll as Doll)
      }
      for (const c of coins) {
        const k = `c${c.id}`
        if (run.taken.includes(c.id)) continue
        want.add(k)
        if (!shown.has(k)) { const sp = new THREE.Sprite(starMat); sp.scale.setScalar(0.75); sp.position.set(0, 0.5 + c.y * U, -c.x * U); scene.add(sp); shown.set(k, sp) }
      }
      for (const g of gifts) {
        const k = `g${g.id}`
        if (run.taken.includes(g.id)) continue
        want.add(k)
        if (!shown.has(k)) { const sp = new THREE.Sprite(giftMat); sp.scale.setScalar(1.1); sp.position.set(0, g.y * U, -g.x * U); scene.add(sp); shown.set(k, sp) }
        shown.get(k)!.position.y = g.y * U + Math.sin(t * 4) * 0.12
      }
      for (const [k, o] of shown) if (!want.has(k)) { scene.remove(o); shown.delete(k) }
      // 아바타: 점프 높이 그대로, 다칠 때 깜빡
      // 그림자는 땅에 두고 그림만 뛰어오른다
      me.root.position.set(0, 0, pz)
      me.body.position.y = run.y * U + (run.y === 0 && !run.over ? Math.abs(Math.sin(t * 11)) * 0.08 : 0)
      me.root.visible = !(run.invuln > 0 && Math.floor(run.invuln * 10) % 2 === 0)
      s.face(me)
      // 친구는 왼쪽 옆 줄에서 조금 뒤에 달리고, 장애물이 오면 저절로 뛰어넘는다
      pals.forEach((d, i) => {
        const fx = run.x - 70 - i * 60
        const hop = friendHop(fx, obstacles)
        d.root.position.set(-1.1, 0, -fx * U)
        d.body.position.y = hop * U + (hop === 0 ? Math.abs(Math.sin(t * 11 + 1)) * 0.07 : 0)
        s.face(d)
      })
      s.view.target.set(0, 1.3, pz - 3)
    })
    return () => { setAvatar.current = () => {}; s.dispose() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, friendKey])
  return <div ref={host} aria-hidden className="absolute inset-0" />
}

