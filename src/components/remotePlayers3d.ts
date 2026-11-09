/**
 * 3D 장면에 멀티플레이어를 붙인다(카페·농장·산책이 같이 쓴다):
 * - 매 프레임 내 위치·방향을 세션에 알려 준다(세션이 보낼 때만 골라 보낸다)
 * - 같은 방의 다른 플레이어를 종이 인형으로 그리고, 받은 위치로 부드럽게 따라가게 한다(보간)
 * - 머리 위에 닉네임, 방금 한 채팅은 말풍선으로
 * 기존 장면 코드는 이 함수 한 줄만 부른다(멀티플레이어를 안 켜면 아무것도 하지 않는다).
 */
import * as THREE from 'three'
import { AVATARS } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import { follow, type PlayerState, type Room } from '../lib/mp/core'
import { getMp, leaveSceneWhere, setPos3d, setSceneWhere } from '../lib/mp/session'
import { AVATAR_H, FEET, type Doll, type World } from './world3d'

interface Remote { doll: Doll; label: THREE.Sprite; labelKey: string; x: number; z: number; t: number; lookKey: string }

function labelCanvas(name: string, chat: string | null) {
  const c = document.createElement('canvas')
  c.width = 512; c.height = chat ? 256 : 96
  const g = c.getContext('2d')!
  g.textAlign = 'center'; g.textBaseline = 'middle'
  if (chat) {
    g.fillStyle = 'rgba(255,255,255,0.96)'
    g.beginPath(); g.roundRect(16, 8, 480, 140, 36); g.fill()
    g.fillStyle = '#c04a5a'; g.font = 'bold 40px sans-serif'
    const line = chat.length > 18 ? `${chat.slice(0, 17)}…` : chat
    g.fillText(line, 256, 78)
  }
  const y = chat ? 205 : 48
  g.font = 'bold 40px sans-serif'
  const w = Math.min(500, g.measureText(name).width + 40)
  g.fillStyle = 'rgba(122,61,143,0.85)'
  g.beginPath(); g.roundRect(256 - w / 2, y - 30, w, 60, 30); g.fill()
  g.fillStyle = '#fff'; g.fillText(name, 256, y + 2)
  return c
}

export function attachMultiplayer(w: World, room: Room) {
  const remotes = new Map<string, Remote>()
  setSceneWhere(room)
  // 내 머리 위 말풍선(내가 방금 한 말): 다른 사람 것과 같은 모양
  const mine = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
  mine.renderOrder = 8
  mine.visible = false
  w.scene.add(mine)
  let mineKey = ''
  let gone = false
  const makeLabel = (r: Remote, p: PlayerState, chat: string | null) => {
    const name = p.away ? `${p.name} · 자리 비움` : p.name
    const key = `${name}|${chat ?? ''}`
    if (key === r.labelKey) return
    r.labelKey = key
    const c = labelCanvas(name, chat)
    const m = r.label.material
    m.map?.dispose()
    m.map = new THREE.CanvasTexture(c); m.map.colorSpace = THREE.SRGBColorSpace; m.needsUpdate = true
    r.label.scale.set(2.4, (2.4 * c.height) / c.width, 1)
  }
  const drawLook = (r: Remote, p: PlayerState) => {
    const key = JSON.stringify(p.look)
    if (key === r.lookKey) return
    r.lookKey = key
    const av = AVATARS.find((a) => a.id === p.look.avatar)
    renderFigure(p.look.outfit, {}, av).then((cv) => {
      if (gone) return
      const m = r.doll.doll.material as THREE.MeshBasicMaterial
      m.map = w.texOf(cv); m.needsUpdate = true
    }).catch(() => {})
  }
  w.onFrame((dt) => {
    if (gone) return
    const mp = getMp()
    // 내 위치(방이 맞을 때만)
    setPos3d(w.me.x, w.me.z, w.me.dir, w.me.moving)
    // 내가 8초 안에 한 말이 있으면 내 머리 위에
    const myLast = mp.room === room && mp.status === 'on' ? [...mp.chat].reverse().find((c) => c.uid === mp.uid && Date.now() - c.t < 8000) : undefined
    mine.visible = !!myLast
    if (myLast) {
      const key = myLast.id
      if (key !== mineKey) {
        mineKey = key
        const c = labelCanvas(myLast.name, myLast.text)
        mine.material.map?.dispose()
        mine.material.map = new THREE.CanvasTexture(c); mine.material.map.colorSpace = THREE.SRGBColorSpace; mine.material.needsUpdate = true
        mine.scale.set(2.4, (2.4 * c.height) / c.width, 1)
      }
      mine.position.set(w.me.x, AVATAR_H + 0.65 + mine.scale.y / 2, w.me.z)
    }
    // 붙어 서 있으면 말풍선이 겹치지 않게 위로 쌓는다
    const placed: { x: number; z: number; y0: number; y1: number }[] = mine.visible ? [{ x: w.me.x, z: w.me.z, y0: mine.position.y - mine.scale.y / 2, y1: mine.position.y + mine.scale.y / 2 }] : []
    const others = mp.room === room && mp.status === 'on' ? Object.entries(mp.players).filter(([uid, p]) => uid !== mp.uid && p.room === room) : []
    const seen = new Set<string>()
    const now = Date.now()
    for (const [uid, p] of others) {
      seen.add(uid)
      let r = remotes.get(uid)
      if (!r) {
        const doll = w.paperDoll(w.texOf(document.createElement('canvas')), AVATAR_H, 1024 / 1536, FEET)
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
        label.renderOrder = 8
        w.scene.add(label)
        r = { doll, label, labelKey: '', x: p.x, z: p.z, t: Math.random() * 5, lookKey: '' }
        remotes.set(uid, r)
      }
      drawLook(r, p)
      const recent = [...mp.chat].reverse().find((c) => c.uid === uid && now - c.t < 8000)
      makeLabel(r, p, recent?.text ?? null)
      // 받은 위치로 부드럽게(보간)
      const k = follow(dt, 8)
      r.x += (p.x - r.x) * k; r.z += (p.z - r.z) * k
      r.t += dt
      const moving = p.moving || Math.hypot(p.x - r.x, p.z - r.z) > 0.05
      r.doll.root.position.set(r.x, 0, r.z)
      r.doll.body.position.y = moving ? Math.abs(Math.sin(r.t * 9)) * 0.12 : 0
      w.face(r.doll, p.dir)
      let y = AVATAR_H + 0.65 + r.label.scale.y / 2
      for (let tries = 0; tries < 10; tries++) {
        const hit = placed.find((q) => Math.hypot(q.x - r!.x, q.z - r!.z) < 2 && y + r!.label.scale.y / 2 > q.y0 && y - r!.label.scale.y / 2 < q.y1)
        if (!hit) break
        y = hit.y1 + r.label.scale.y / 2 + 0.05
      }
      placed.push({ x: r.x, z: r.z, y0: y - r.label.scale.y / 2, y1: y + r.label.scale.y / 2 })
      r.label.position.set(r.x, y, r.z)
    }
    for (const [uid, r] of remotes) if (!seen.has(uid)) {
      w.scene.remove(r.doll.root); w.scene.remove(r.label); r.label.material.map?.dispose(); r.label.material.dispose()
      remotes.delete(uid)
    }
  })
  return () => {
    gone = true
    leaveSceneWhere(room)
    w.scene.remove(mine); mine.material.map?.dispose(); mine.material.dispose()
    for (const r of remotes.values()) { w.scene.remove(r.doll.root); w.scene.remove(r.label); r.label.material.map?.dispose(); r.label.material.dispose() }
    remotes.clear()
  }
}
