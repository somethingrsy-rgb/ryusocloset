import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useI18n } from '../i18n'
import { renderFigure } from '../lib/exportPng'
import type { SceneAssets } from '../lib/exportRoom'
import { assetUrl } from '../lib/items'
import { ROOM_ITEM_BY_ID, avatarSize, itemSize, moveTo, removeItem, sameSelection, scaleBy, toggleFlip } from '../lib/room'
import { ROOM_H, ROOM_W, type RoomState, type Selection } from '../lib/roomTypes'
import { playTap } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { createStage, type Doll, type Stage } from './stage3d'

/**
 * 방 3D 보기: 지금 꾸민 방(벽지·바닥·물건·아바타 자리)을 3D 방 상자 안에 세워서 보여 준다. 끌면 방을 둘러본다.
 * 물건 놓기(아래 소품 칸)·되돌리기·처음으로는 원래 방 그대로 쓰고, 여기서는 물건을 눌러 고른 뒤
 * 바닥을 누르면 그 자리로 옮기고, 아래 단추로 크게·작게·뒤집기·치우기를 한다(같은 방 저장을 바꾼다).
 * 방 좌표(가로 ROOM_W, 세로 ROOM_H)에서 바닥 그림이 시작하는 높이 아래는 바닥(앞뒤 깊이), 그 위는 뒷벽 높이로 옮긴다.
 */
const U = 1 / 100

export function Room3D({ outfit, tweaks, room, selection, onSelect, onChange, assets, children }: {
  outfit: Outfit; tweaks: Tweaks; room: RoomState; selection: Selection
  onSelect: (s: Selection) => void; onChange: (next: RoomState) => void
  assets: SceneAssets; children?: ReactNode
}) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const host = useRef<HTMLDivElement>(null)
  const stage = useRef<Stage | null>(null)
  const live = useRef({ room, selection, onSelect, onChange })
  live.current = { room, selection, onSelect, onChange }
  const [hint, setHint] = useState(true)
  const FT = ROOM_H - assets.floorH // 바닥이 시작하는 높이(방 좌표)
  const D = assets.floorH * U * 2.2 // 바닥 깊이
  const Wd = ROOM_W * U

  // 방 좌표 ↔ 3D 자리
  const to3 = (x: number, y: number) => (y >= FT ? { x: (x - ROOM_W / 2) * U, y: 0, z: ((y - FT) / assets.floorH) * D } : { x: (x - ROOM_W / 2) * U, y: (FT - y) * U, z: 0.03 })
  const conv = useRef(to3)
  conv.current = to3

  useEffect(() => {
    const el = host.current
    if (!el) return
    const picks: THREE.Object3D[] = []
    const s = createStage(el, {
      sky: 0xfdf3f6, orbit: true, pitchRange: [0.08, 0.9], yawRange: [-0.65, 0.65], shadows: true,
      view: { yaw: 0, pitch: 0.28, dist: 11, target: [0, FT * U * 0.32, D * 0.5] },
      pickables: picks,
      onPick: (o, sx, sy) => {
        // 물건을 고른 채 깔개(바닥에 누운 것)를 누르면 그 자리로 옮긴다
        if (live.current.selection && o.userData.rug && !sameSelection(o.userData.sel, live.current.selection)) { moveHere(sx, sy); return }
        playTap(); live.current.onSelect(o.userData.sel as Selection); setHint(false)
      },
      // 고른 물건이 있으면 누른 바닥 자리로 옮긴다
      onTap: (sx, sy) => moveHere(sx, sy),
      fov: (w, h) => (w < h ? 70 : 50),
    })
    function moveHere(sx: number, sy: number) {
      const { selection: sel, room: r } = live.current
      if (!sel) return
      const p = s.ground(sx, sy)
      if (!p || p.z < 0 || p.z > D || Math.abs(p.x) > Wd / 2 + 1) { live.current.onSelect(null); return }
      live.current.onChange(moveTo(r, sel, p.x / U + ROOM_W / 2, FT + (p.z / D) * assets.floorH))
    }
    stage.current = s
    const { scene, keep, lambert } = s
    // 방 폭이 화면에 다 들어오게 거리를 맞춘다
    {
      const { w, h } = s.size()
      const hf = 2 * Math.atan(Math.tan((s.camera.fov * Math.PI) / 360) * (w / h))
      s.view.dist = D + (Wd * 0.55) / Math.tan(hf / 2)
      s.view.target.set(0, FT * U * 0.3, D * 0.45)
    }
    // 방 상자: 바닥(바닥 그림) + 뒷벽(벽지 그림 위쪽) + 옆벽
    const floorTex = s.texOf(assets.floor)
    const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(Wd, D)), keep(new THREE.MeshLambertMaterial({ map: floorTex })))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0, D / 2)
    floor.receiveShadow = true
    const wallTex = s.texOf(assets.wall)
    wallTex.repeat.set(1, FT / ROOM_H)
    wallTex.offset.set(0, 1 - FT / ROOM_H)
    const back = new THREE.Mesh(keep(new THREE.PlaneGeometry(Wd, FT * U)), keep(new THREE.MeshLambertMaterial({ map: wallTex })))
    back.position.set(0, (FT * U) / 2, 0)
    back.receiveShadow = true
    // 옆벽은 안쪽에서만 보인다(돌려 보면 바깥쪽 벽이 방을 가리지 않게)
    const sideMat = keep(new THREE.MeshLambertMaterial({ color: 0xfbe9ef }))
    for (const sd of [-1, 1]) {
      const side = new THREE.Mesh(keep(new THREE.PlaneGeometry(D, FT * U)), sideMat)
      side.rotation.y = (-sd * Math.PI) / 2
      side.position.set((sd * Wd) / 2, (FT * U) / 2, D / 2)
      side.receiveShadow = true
      scene.add(side)
    }
    const base = new THREE.Mesh(keep(new THREE.BoxGeometry(Wd + 0.2, 0.12, D + 0.2)), lambert(0xe7c9a8))
    base.position.set(0, -0.07, D / 2)
    scene.add(floor, back, base)
    // 고른 것 표시(바닥 둥근 테두리)
    const ring = new THREE.Mesh(keep(new THREE.RingGeometry(0.85, 1, 32)), keep(new THREE.MeshBasicMaterial({ color: 0xff6f91, transparent: true, opacity: 0.9, depthWrite: false })))
    ring.rotation.x = -Math.PI / 2
    ring.visible = false
    scene.add(ring)

    // 물건·아바타: 방 상태가 바뀌면 다시 놓는다(그림은 한 번 읽은 것을 다시 쓴다)
    const tex = new Map<string, THREE.Texture>()
    const texFor = (src: string) => { if (!tex.has(src)) tex.set(src, s.texOf(assetUrl(src))); return tex.get(src)! }
    const placed = new Map<string, { doll?: Doll; flat?: THREE.Mesh; key: string }>()
    let avatarDoll: Doll | null = null
    let avatarCanvas: HTMLCanvasElement | null = null
    const layout = () => {
      const { room: r, selection: sel } = live.current
      const seen = new Set<string>()
      r.items.forEach((p) => {
        const def = ROOM_ITEM_BY_ID[p.itemId]
        if (!def) return
        seen.add(p.uid)
        const { w, h } = itemSize(def, p.scale)
        const at = conv.current(p.x, p.y)
        const key = `${p.itemId}|${w}`
        let v = placed.get(p.uid)
        if (!v || v.key !== key) {
          if (v) { if (v.doll) scene.remove(v.doll.root); if (v.flat) scene.remove(v.flat) }
          if (def.group === 'rug') {
            // 깔개는 바닥에 눕힌다(그림이 원근으로 그려져 있어 앞뒤로 조금 늘린다)
            const flat = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshBasicMaterial({ map: texFor(def.image), transparent: true, alphaTest: 0.3, depthWrite: false })))
            flat.rotation.x = -Math.PI / 2
            flat.userData = { sel: { kind: 'item', uid: p.uid }, rug: true }
            scene.add(flat)
            v = { flat, key }
          } else {
            const d = s.paperDoll(texFor(def.image), h * U, w / h, 1, def.group !== 'wall' && at.y === 0)
            d.root.userData.sel = { kind: 'item', uid: p.uid }
            v = { doll: d, key }
          }
          placed.set(p.uid, v)
        }
        if (v.flat) {
          v.flat.scale.set(w * U * (p.flip ? -1 : 1), h * U * 2, 1)
          v.flat.position.set(at.x, 0.015, Math.max(0, at.z - h * U))
        } else if (v.doll) {
          v.doll.root.position.set(at.x, at.y, at.z)
          v.doll.root.userData.flip = p.flip ? -1 : 1
        }
      })
      for (const [uid, v] of placed) if (!seen.has(uid)) { if (v.doll) scene.remove(v.doll.root); if (v.flat) scene.remove(v.flat); placed.delete(uid) }
      // 아바타
      const av = r.avatar, { w, h } = avatarSize(av.scale), at = conv.current(av.x, av.y)
      if (!avatarDoll || avatarDoll.root.userData.h !== h) {
        if (avatarDoll) scene.remove(avatarDoll.root)
        avatarDoll = s.paperDoll(null, h * U, w / h, 1504 / 1536)
        avatarDoll.root.userData = { sel: { kind: 'avatar' }, h }
        if (avatarCanvas) s.setMap(avatarDoll, s.texOf(avatarCanvas))
      }
      avatarDoll.root.position.set(at.x, 0, at.z)
      avatarDoll.root.userData.flip = av.flip ? -1 : 1
      picks.length = 0
      for (const v of placed.values()) picks.push(v.doll ? v.doll.root : v.flat!)
      picks.push(avatarDoll.root)
      // 고른 것 표시
      const selObj = sel ? picks.find((o) => sameSelection(o.userData.sel, sel)) : undefined
      ring.visible = !!selObj
      if (selObj) { ring.position.set(selObj.position.x, 0.02, selObj.position.z); ring.scale.setScalar(selObj === avatarDoll.root ? 0.7 : 0.9) }
    }
    s.onFrame(() => {
      layout()
      for (const v of placed.values()) if (v.doll) { const onWall = v.doll.root.position.y > 0.01; if (onWall) { v.doll.body.rotation.y = 0; v.doll.doll.scale.x = Math.abs(v.doll.doll.scale.x) * v.doll.root.userData.flip } else s.face(v.doll, v.doll.root.userData.flip) }
      if (avatarDoll) s.face(avatarDoll, avatarDoll.root.userData.flip)
    })
    ;(s as Stage & { setAvatar?: (cv: HTMLCanvasElement) => void }).setAvatar = (cv) => { avatarCanvas = cv; if (avatarDoll) s.setMap(avatarDoll, s.texOf(cv)) }
    return () => { stage.current = null; s.dispose() }
    // 벽지·바닥이 바뀌면 방 상자를 새로 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.wall, assets.floor, assets.floorH])

  useEffect(() => {
    let alive = true
    renderFigure(outfit, tweaks).then((cv) => { const s = stage.current as (Stage & { setAvatar?: (cv: HTMLCanvasElement) => void }) | null; if (alive) s?.setAvatar?.(cv) }).catch(() => {})
    return () => { alive = false }
  }, [outfit, tweaks, assets.wall, assets.floor])

  const sel = selection
  const btn = 'flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-bold shadow-md active:scale-95'
  return (
    <div className="relative h-full overflow-hidden rounded-3xl bg-[#fdf3f6] ring-1 ring-black/5 select-none">
      <div ref={host} className="absolute inset-0" />
      {children}
      {hint && !sel && <p className="pointer-events-none absolute inset-x-3 bottom-20 z-10 m-0 text-center text-xs font-bold text-[#8a4b55] drop-shadow-[0_1px_0_white]">{ko ? '끌어서 둘러봐요 · 물건을 누르고 바닥을 누르면 옮겨요' : 'Drag to look around · tap an item, then tap the floor to move it'}</p>}
      {sel && (
        <div className="absolute top-2 left-2 z-20 flex max-w-[calc(100%-4.5rem)] flex-wrap items-center gap-1.5 rounded-3xl bg-white/80 p-1.5 shadow-lg">
          <span className="px-2 text-xs font-bold text-[#8a4b55]">{ko ? '바닥을 누르면 옮겨요' : 'Tap the floor to move'}</span>
          <button aria-label={ko ? '크게' : 'Bigger'} className={`${btn} bg-white/95`} onClick={() => { playTap(); onChange(scaleBy(room, sel, 1.1)) }}>＋</button>
          <button aria-label={ko ? '작게' : 'Smaller'} className={`${btn} bg-white/95`} onClick={() => { playTap(); onChange(scaleBy(room, sel, 1 / 1.1)) }}>－</button>
          <button aria-label={ko ? '뒤집기' : 'Flip'} className={`${btn} bg-white/95`} onClick={() => { playTap(); onChange(toggleFlip(room, sel)) }}>↔</button>
          {sel.kind === 'item' && <button aria-label={ko ? '치우기' : 'Remove'} className={`${btn} bg-white/95`} onClick={() => { playTap(); onChange(removeItem(room, sel.uid)); onSelect(null) }}>🗑️</button>}
          <button aria-label={ko ? '다 됐어요' : 'Done'} className={`${btn} bg-[#ff8fab] text-white`} onClick={() => { playTap(); onSelect(null) }}>✓</button>
        </div>
      )}
    </div>
  )
}
