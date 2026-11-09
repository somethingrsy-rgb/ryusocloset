/**
 * 같이 사냥하는 대왕 몬스터(같이 놀기): 3D 산책·농장·카페가 같이 쓴다. 장소마다 서버에 하나씩 있고(lobby/bosses/{장소}),
 * 같은 장소에 있는 친구들이 같은 몬스터를 보며 💖 를 같이 채운다. 다 채우면 친 사람은 30 코인 + 도감.
 * 장면은 attachBoss 한 번만 부르고, 몬스터를 누르면 pick, 마법 단추는 zap, 화면 글은 onUi 로 받는다.
 */
import * as THREE from 'three'
import { BOSS_MAX, bossCanRespawn, type Room } from '../lib/mp/core'
import { getMp, hitBoss, serverNow, spawnBoss } from '../lib/mp/session'
import { MONSTERS, addDex } from '../lib/monsters'
import { actFarm } from '../lib/farm'
import { assetUrl } from '../lib/items'
import { playOrder, playServe, playTap } from '../lib/sound'
import { SPARKLE_IMG } from './Sparkle'
import { ANIMAL_H, emojiCanvas, type World } from './world3d'

export interface BossUi { type: number; hp: number; max: number; far: number; fight: boolean; friends: string[] }
export interface BossDone { type: number; friends: string[]; isNew: boolean }
export interface BossHunt {
  /** 눌린 것이 대왕 몬스터면 처리하고 true(싸우는 중이면 마법, 아니면 걸어간다) */
  pick: (o: THREE.Object3D) => boolean
  /** 마법 한 번(power 만큼 💖), tex 는 날아가는 그림 */
  zap: (power: number, tex?: THREE.Texture) => void
  /** 몬스터 앞까지 걸어가서 싸우기 시작 / 잠깐 쉬기 */
  go: () => void
  rest: () => void
  fighting: () => boolean
  /** 이 물체가 대왕 몬스터인지 */
  owns: (o: THREE.Object3D) => boolean
}

/** 대왕 몬스터 키: 산책의 작은 몬스터(동물 키 × 1.35)의 1.7배 */
export const BOSS_H = ANIMAL_H * 1.35 * 1.7

export function attachBoss(w: World, room: Room, opts: {
  /** 새 몬스터를 낼 자리(빈 땅) */
  spot: () => { x: number; z: number }
  /** 지금 싸우기 시작해도 되는지(다른 놀이 중이면 false) */
  canFight?: () => boolean
  onUi: (u: BossUi | null) => void
  onDone: (d: BossDone) => void
  /** 마법 한 번의 힘(산책은 고른 마법봉 힘, 농장·카페는 2) */
  power?: number
}): BossHunt {
  const texCache = new Map<string, THREE.Texture>()
  const monTex = (id: string, mood: 'angry' | 'happy') => { const k = `${id}_${mood}`; if (!texCache.has(k)) texCache.set(k, w.texOf(assetUrl(`travel/monster/${k}.webp`))); return texCache.get(k)! }
  const doll = w.paperDoll(monTex(MONSTERS[0].id, 'angry'), BOSS_H, 1)
  doll.root.visible = false
  w.pickables.push(doll.root)
  const mat = doll.doll.material as THREE.MeshBasicMaterial
  const bs = { id: '', type: 0, hp: 0, max: BOSS_MAX, x: 0, z: 0, shake: 0, spin: -1, happy: false, t: 0, cool: false, mine: 0, fight: false }
  const myHits = new Set<string>()
  let spawnTry = -1e9, uiKey = ''
  // 반짝이(마법이 날아가고, 맞으면 튀고, 풀리면 사방으로)
  const fxTex = [w.texOf(assetUrl(SPARKLE_IMG)), w.texOf(emojiCanvas('⭐')), w.texOf(emojiCanvas('💖'))]
  const fx: { sp: THREE.Sprite; v: THREE.Vector3; life: number; max: number; to?: THREE.Vector3; from?: THREE.Vector3; onHit?: () => void }[] = []
  const spark = (tex: THREE.Texture, at: THREE.Vector3, size: number) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.position.copy(at); sp.scale.setScalar(size); w.scene.add(sp); return sp }
  const on = () => doll.root.visible && bs.hp > 0
  const to = () => new THREE.Vector3(bs.x, BOSS_H * 0.5, bs.z)
  const nearFriends = (r: number) => { const mp = getMp(); return Object.entries(mp.players).filter(([uid, p]) => uid !== mp.uid && p.room === room && Math.hypot(p.x - bs.x, p.z - bs.z) < r).map(([, p]) => p) }
  const start = () => {
    if (!on() || (opts.canFight && !opts.canFight())) return
    bs.fight = true; bs.cool = false
    playOrder()
    w.walkTo(w.me.x, w.me.z)
  }
  const api: BossHunt = {
    pick: (o) => { if (o !== doll.root) return false; if (bs.fight) api.zap(opts.power ?? 1); else api.go(); return true },
    go: () => { if (on()) w.walkTo(bs.x, bs.z, start, 5) },
    rest: () => { bs.fight = false; bs.cool = true },
    fighting: () => bs.fight,
    owns: (o) => o === doll.root,
    zap: (power, tex) => {
      if (!bs.fight || !on()) return
      const id = bs.id, from = new THREE.Vector3(w.me.x, 1.4, w.me.z), t = to(), ft = tex ?? fxTex[0]
      playTap()
      fx.push({ sp: spark(ft, from, 0.6 + power * 0.2), v: new THREE.Vector3(), life: 0, max: 0.35, from, to: t, onHit: () => {
        for (let i = 0; i < 3 + power * 2; i++) fx.push({ sp: spark(i % 2 ? ft : fxTex[1], t, 0.5), v: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), life: 0, max: 0.6 })
        if (id !== bs.id || bs.hp <= 0) return
        myHits.add(id); bs.mine += power; bs.shake = 0.3
        hitBoss(room, id, power)
      } })
    },
  }
  w.onFrame((dt, now) => {
    const mp = getMp(), b = mp.status === 'on' ? mp.bosses[room] ?? null : null
    // 없거나 풀리고 조금 지났으면 누군가(먼저 한 사람) 새로 낸다
    if (mp.status === 'on' && bossCanRespawn(b, serverNow()) && now - spawnTry > 3000) {
      spawnTry = now
      spawnBoss(room, { id: Math.random().toString(36).slice(2, 10), type: Math.floor(Math.random() * MONSTERS.length), ...opts.spot(), hp: BOSS_MAX, max: BOSS_MAX })
    }
    // 반짝이
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]
      f.life += dt
      const u = Math.min(1, f.life / f.max)
      if (f.to && f.from) f.sp.position.lerpVectors(f.from, f.to, u).setY(f.from.y + (f.to.y - f.from.y) * u + Math.sin(u * Math.PI) * 0.8)
      else { f.sp.position.addScaledVector(f.v, dt); f.v.y -= dt * 3; f.sp.material.opacity = 1 - u }
      f.sp.material.rotation += dt * 4
      if (u >= 1) { w.scene.remove(f.sp); f.sp.material.dispose(); fx.splice(i, 1); f.onHit?.() }
    }
    // 마법이 풀리고 6초 지나면 사라졌다가 새로 나온다
    const show = !!b && (b.hp > 0 || serverNow() - b.t < 6000)
    doll.root.visible = show
    if (!b || !show) { bs.fight = false; bs.hp = 0; if (uiKey) { uiKey = ''; opts.onUi(null) } return }
    if (b.id !== bs.id) {
      const info = MONSTERS[b.type % MONSTERS.length]
      Object.assign(bs, { id: b.id, type: b.type % MONSTERS.length, hp: b.hp, max: b.max, x: b.x, z: b.z, spin: -1, happy: b.hp <= 0, cool: false, mine: 0, fight: false })
      mat.map = monTex(info.id, b.hp > 0 ? 'angry' : 'happy'); mat.needsUpdate = true
      doll.body.scale.set(info.size[0] / info.size[1], 1, 1)
      doll.root.position.set(b.x, 0, b.z)
    } else if (b.hp < bs.hp) {
      // 깎인 만큼: 내가 친 것 말고는 친구가 친 것 → 친구 쪽에서 하트가 날아온다
      const dec = bs.hp - b.hp, mine = Math.min(dec, bs.mine)
      bs.mine -= mine; bs.shake = 0.3
      if (dec > mine) {
        const fr = nearFriends(14).sort((p, q) => Math.hypot(p.x - bs.x, p.z - bs.z) - Math.hypot(q.x - bs.x, q.z - bs.z))[0]
        const a = Math.random() * Math.PI * 2, from = fr ? new THREE.Vector3(fr.x, 1.4, fr.z) : new THREE.Vector3(bs.x + Math.cos(a) * 3, 1.4, bs.z + Math.sin(a) * 3)
        fx.push({ sp: spark(fxTex[2], from, 0.7), v: new THREE.Vector3(), life: 0, max: 0.35, from, to: to() })
      }
      bs.hp = b.hp
      if (b.hp <= 0 && !bs.happy) {
        bs.spin = 0
        playServe()
        const t = to()
        for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; fx.push({ sp: spark(fxTex[i % 3], t.clone(), 0.8), v: new THREE.Vector3(Math.cos(a) * 4.5, 2 + Math.random() * 3, Math.sin(a) * 4.5), life: 0, max: 1.8 }) }
        if (myHits.has(b.id)) {
          actFarm({ type: 'earn', amount: 30 })
          const friends = nearFriends(16).map((p) => p.name), type = bs.type, isNew = addDex(MONSTERS[type].id)
          window.setTimeout(() => opts.onDone({ type, friends, isNew }), 1000)
        }
        bs.fight = false
      }
    }
    bs.t += dt
    const dMe = Math.hypot(w.me.x - bs.x, w.me.z - bs.z)
    if (bs.cool && dMe > 10) bs.cool = false
    if (bs.fight && dMe > 10) bs.fight = false
    if (!bs.fight && !bs.cool && bs.hp > 0 && dMe < 5.5) start()
    // 움직임: 제자리에서 통통, 맞으면 흔들, 풀리면 빙글
    w.face(doll, w.me.x < bs.x ? -1 : 1)
    let sx = 0
    if (bs.shake > 0) { bs.shake -= dt; sx = Math.sin(bs.shake * 60) * 0.25 }
    doll.body.position.set(sx, Math.abs(Math.sin(bs.t * (bs.happy ? 3 : 2))) * (bs.happy ? 0.25 : 0.1), 0)
    if (bs.spin >= 0) {
      bs.spin += dt / 0.9
      const u = Math.min(1, bs.spin), ease = 1 - Math.pow(1 - u, 3)
      if (u >= 0.3 && !bs.happy) { bs.happy = true; mat.map = monTex(MONSTERS[bs.type].id, 'happy'); mat.needsUpdate = true }
      if (bs.spin >= 1) { bs.spin = -1; doll.root.scale.setScalar(1) }
      else { doll.body.rotation.y += ease * Math.PI * 6; doll.body.position.y += Math.sin(u * Math.PI) * 0.9; doll.root.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.15) }
    }
    // 화면 글(바뀔 때만)
    const friends = nearFriends(12).map((p) => p.name)
    const far = bs.fight ? 0 : Math.max(1, Math.round(dMe / 5) * 5)
    const key = `${bs.id}|${b.hp}|${far}|${bs.fight}|${friends.join(',')}`
    if (key !== uiKey) { uiKey = key; opts.onUi(b.hp > 0 ? { type: bs.type, hp: b.hp, max: b.max, far, fight: bs.fight, friends } : null) }
  })
  return api
}

/** 빈 땅 고르기: 범위 안에서 장애물(r + 2.5)과 피할 자리(avoid)에서 떨어진 곳 */
export function freeSpot(w: World, half: number, avoid: { x: number; z: number; r: number }[] = []) {
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * 2 * half, z = (Math.random() - 0.5) * 2 * half
    if (w.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 2.5) || avoid.some((o) => Math.hypot(o.x - x, o.z - z) < o.r)) continue
    return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }
  }
  return { x: 0, z: half * 0.5 }
}
