import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { AVATARS, avatarName } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import { assetUrl } from '../lib/items'
import { FH, FW, GOAL_BOT, GOAL_TOP, type Match, type Team, type Vec } from '../lib/soccer'
import { createStage, cuteTree, emojiCanvas, type Doll } from './stage3d'

/**
 * 축구 3D 무대: 경기 규칙·조작·점수판은 원래 축구 화면 그대로이고, 경기장과 선수만 3D 로 그린다.
 * 경기장 좌표(가로 FW × 세로 FH)를 땅에 눕혀서 중계 화면처럼 옆에서 비스듬히 본다(경기장 +x = 화면 오른쪽, +y = 화면 아래쪽).
 * api 로 화면 자리 ↔ 경기장 자리를 바꿔 준다(손가락으로 끌기·아바타 만지기).
 */
const U = 0.2 // 경기장 1 단위 = 0.2 장면 단위
const w3 = (x: number, y: number) => new THREE.Vector3((x - FW / 2) * U, 0, (y - FH / 2) * U)
export const TEAM_COLOR: Record<Team, string> = { 0: '#e2475b', 1: '#9a7be0' }
const KIT: Record<Team, { costume: string; shoes: string }> = { 0: { costume: 'costume_soccer_red', shoes: 'shoes_soccer_red' }, 1: { costume: 'costume_soccer_purple', shoes: 'shoes_soccer_purple' } }

/** 이름표(둥근 띠 + 흰 글자) */
function tagCanvas(text: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 64
  const g = c.getContext('2d')!
  g.font = '900 34px system-ui, sans-serif'
  const w = Math.min(248, g.measureText(text).width + 32)
  g.fillStyle = color
  g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 48, 24); g.fill()
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 128, 33)
  return c
}

export interface SoccerApi { toField: (sx: number, sy: number) => Vec | null; toScreen: (x: number, y: number) => { x: number; y: number } }

export function Soccer3D({ live, party, api }: { live: MutableRefObject<Match>; party: MutableRefObject<{ team: Team } | null>; api: MutableRefObject<SoccerApi | null> }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const s = createStage(el, { sky: 0xbfe6ff, fog: [40, 90], view: { yaw: 0, pitch: 0.82, dist: 22, target: [0, 0, 0.6] } })
    const { scene, keep, lambert } = s

    // 바깥 잔디 + 나무
    const outer = new THREE.Mesh(keep(new THREE.PlaneGeometry(140, 140)), lambert(0x8fd16a))
    outer.rotation.x = -Math.PI / 2
    outer.position.y = -0.01
    outer.receiveShadow = true
    scene.add(outer)
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2, r = 19 + (k % 3) * 3
      const x = Math.cos(a) * r * 1.3, z = Math.sin(a) * r * 0.9
      if (z > 6) continue // 카메라 앞은 비운다
      cuteTree(s, x, z - 4, 0.9 + (k % 4) * 0.15, [0x6cc35a, 0x5fb24f, 0xffb7cf][k % 3])
    }
    // 경기장: 줄무늬 잔디 + 흰 선(그림 한 장)
    const fc = document.createElement('canvas')
    fc.width = 1000; fc.height = 600
    const g = fc.getContext('2d')!
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#63b254' : '#6fbf5f'; g.fillRect(i * 100, 0, 100, 600) }
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 6
    g.strokeRect(4, 4, 992, 592)
    g.beginPath(); g.moveTo(500, 0); g.lineTo(500, 600); g.stroke()
    g.beginPath(); g.arc(500, 300, 80, 0, Math.PI * 2); g.stroke()
    g.strokeRect(0, 140, 140, 320); g.strokeRect(860, 140, 140, 320)
    const field = new THREE.Mesh(keep(new THREE.PlaneGeometry(FW * U, FH * U)), keep(new THREE.MeshLambertMaterial({ map: s.texOf(fc) })))
    field.rotation.x = -Math.PI / 2
    field.receiveShadow = true
    scene.add(field)
    // 골대: 흰 기둥·가로대 + 그물(반투명) + 팀 색 바닥 띠
    const postMat = lambert(0xffffff), netMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }))
    const goalH = 1.3, depth = 3.5 * U, gw = (GOAL_BOT - GOAL_TOP) * U
    ;([0, 1] as Team[]).forEach((t) => {
      const grp = new THREE.Group()
      const sgn = t === 0 ? -1 : 1
      for (const y of [GOAL_TOP, GOAL_BOT]) {
        const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.06, goalH, 8)), postMat)
        post.position.copy(w3(t === 0 ? 0 : FW, y)).setY(goalH / 2)
        post.castShadow = true
        grp.add(post)
      }
      const bar = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.06, gw, 8)), postMat)
      bar.rotation.x = Math.PI / 2
      bar.position.copy(w3(t === 0 ? 0 : FW, (GOAL_TOP + GOAL_BOT) / 2)).setY(goalH)
      grp.add(bar)
      const net = new THREE.Mesh(keep(new THREE.BoxGeometry(depth, goalH, gw)), netMat)
      net.position.copy(w3(t === 0 ? 0 : FW, (GOAL_TOP + GOAL_BOT) / 2)).setY(goalH / 2).add(new THREE.Vector3(sgn * depth / 2, 0, 0))
      grp.add(net)
      const strip = new THREE.Mesh(keep(new THREE.PlaneGeometry(depth, gw)), keep(new THREE.MeshBasicMaterial({ color: TEAM_COLOR[t], transparent: true, opacity: 0.6 })))
      strip.rotation.x = -Math.PI / 2
      strip.position.copy(net.position).setY(0.02)
      grp.add(strip)
      scene.add(grp)
    })

    // 선수: 아바타는 축구복 입은 아바타 그림, 동물은 팀 조끼 그림. 발밑에 팀 색 동그라미, 머리 위 이름표
    const discGeo = keep(new THREE.CircleGeometry(1, 24))
    const tex = new Map<string, THREE.Texture>()
    const animalTex = (img: string, pose: string, team: Team) => {
      const k = `${img}_${pose}_${team === 0 ? 'red' : 'purple'}`
      if (!tex.has(k)) tex.set(k, s.texOf(assetUrl(`cafe/soccer/${k}.webp`)))
      return tex.get(k)!
    }
    const dolls: { doll: Doll; disc: THREE.Mesh; tag?: THREE.Sprite; human: boolean; img?: string; who: string | number; pose?: string }[] = []
    let setup = ''
    const build = (m: Match) => {
      for (const d of dolls) { scene.remove(d.doll.root); scene.remove(d.disc) }
      dolls.length = 0
      m.players.forEach((p) => {
        const human = p.role === 'human'
        const h = (human ? 12 : 8) * U
        const doll = s.paperDoll(null, h, human ? 1024 / 1536 : 1, human ? 1504 / 1536 : 1, false)
        const disc = new THREE.Mesh(discGeo, keep(new THREE.MeshBasicMaterial({ color: TEAM_COLOR[p.team], transparent: true, opacity: 0.55, depthWrite: false })))
        disc.rotation.x = -Math.PI / 2
        disc.scale.set(h * 0.32, h * 0.2, 1)
        scene.add(disc)
        let tag: THREE.Sprite | undefined
        if (human) {
          const a = AVATARS.find((x) => x.id === p.who) ?? AVATARS[0]
          renderFigure({ costume: KIT[p.team].costume, shoes: KIT[p.team].shoes }, {}, a).then((cv) => s.setMap(doll, s.texOf(cv))).catch(() => {})
          tag = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: s.texOf(tagCanvas(avatarName(a), TEAM_COLOR[p.team])), depthTest: false })))
        } else {
          s.setMap(doll, animalTex(CALL_ANIMALS[p.who as number].img, 'stand', p.team))
          if (p.role === 'keeper') tag = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: s.texOf(tagCanvas('🧤 골키퍼', TEAM_COLOR[p.team])), depthTest: false })))
        }
        if (tag) { tag.scale.set(2, 0.5, 1); tag.renderOrder = 10; scene.add(tag) }
        dolls.push({ doll, disc, tag, human, img: human ? undefined : CALL_ANIMALS[p.who as number].img, who: p.who })
      })
    }

    // 공: ⚽ 그림을 세운 판 + 그림자
    const ball = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: s.texOf(emojiCanvas('⚽')) })))
    ball.scale.setScalar(0.85)
    scene.add(ball)
    const ballShadow = new THREE.Mesh(discGeo, keep(new THREE.MeshBasicMaterial({ color: 0x24401c, transparent: true, opacity: 0.3, depthWrite: false })))
    ballShadow.rotation.x = -Math.PI / 2
    ballShadow.scale.setScalar(0.3)
    scene.add(ballShadow)

    // 화면 크기에 맞춰 경기장이 다 보이게 거리를 정한다
    const fit = () => {
      const { w, h } = s.size()
      const vf = (s.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * (w / h))
      s.view.dist = Math.max(11, (FW * U * 0.56) / Math.tan(hf / 2), (FH * U * 0.62) / Math.tan(vf / 2))
    }
    let t = 0
    s.onFrame((dt) => {
      fit()
      const m = live.current
      const key = m.players.map((p) => `${p.team}${p.role}${p.who}`).join()
      if (key !== setup) { setup = key; build(m) }
      t += dt
      const pt = party.current?.team
      m.players.forEach((p, i) => {
        const d = dolls[i]
        if (!d) return
        const pos = w3(p.x, p.y)
        d.doll.root.position.copy(pos)
        d.disc.position.copy(pos).setY(0.02)
        const cheer = pt === p.team
        d.doll.body.position.y = cheer ? Math.abs(Math.sin(t * 9 + i)) * 0.35 : 0
        const pose = cheer ? 'wave' : 'stand'
        if (!d.human && d.img && d.pose !== pose) { d.pose = pose; s.setMap(d.doll, animalTex(d.img, pose, p.team)) }
        s.face(d.doll, p.dir as 1 | -1)
        if (d.tag) d.tag.position.copy(pos).setY((d.human ? 12 : 8) * U + 0.35 + d.doll.body.position.y)
      })
      const b = m.ball, bp = w3(b.x, b.y)
      const sp = Math.hypot(b.vx, b.vy)
      ball.position.copy(bp).setY(0.42 + Math.min(0.5, sp / 120) * Math.abs(Math.sin(t * 6)))
      ball.material.rotation -= dt * sp * 0.08 * (b.vx >= 0 ? 1 : -1)
      ballShadow.position.copy(bp).setY(0.015)
    })

    api.current = {
      toField: (sx, sy) => { const p = s.ground(sx, sy); return p ? { x: p.x / U + FW / 2, y: p.z / U + FH / 2 } : null },
      toScreen: (x, y) => s.project(w3(x, y)),
    }
    return () => { api.current = null; s.dispose() }
  }, [live, party, api])
  return <div ref={host} aria-hidden className="absolute inset-0" />
}
