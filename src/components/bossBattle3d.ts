import * as THREE from 'three'
import { BOSS_MAX, bossCanRespawn, follow } from '../lib/mp/core'
import { BATTLE_WEAPON_SLOT, BOSS_ARENAS, BOSS_MONSTERS, availableBattleWeapons, battleWeapon, canStrikeBoss, encodeBattleAttack, freshBattleAttack, type BattleWeapon, type BossRoom } from '../lib/mp/bossCombat'
import { getMp, hitBoss, serverNow, setBattlePose, spawnBoss } from '../lib/mp/session'
import { assetUrl } from '../lib/items'
import { playTap, playBell } from '../lib/sound'
import { emojiCanvas, type World } from './world3d'

export interface BossBattleState { visible: boolean; hp: number; max: number; distance: number; inRange: boolean; cooling: boolean; weapon: BattleWeapon; note: string }
export interface BossBattle {
  subscribe: (fn: () => void) => () => void
  getSnapshot: () => BossBattleState
  weapons: BattleWeapon[]
  equip: (id: string) => void
  attack: () => void
  approach: () => void
  dispose: () => void
}
interface Hand { sprite: THREE.Sprite; x: number; z: number; swingAt: number; weapon: BattleWeapon }
interface Effect { sprite: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; age: number; life: number; hit: (() => void) | null; sword: boolean }

/** 실제 장면의 보스와 HUD를 연결한다. 체력은 공유 트랜잭션, 손 무기와 휘두르기는 플레이어 경로로 동기화한다. */
export function attachBossBattle(w: World, room: BossRoom): BossBattle {
  const weapons = availableBattleWeapons()
  let selected = weapons[0]
  try { const saved = localStorage.getItem('ryuso.boss.weapon'); selected = weapons.find(p => p.id === saved) ?? selected } catch { /* 기본 무기 */ }
  let state: BossBattleState = { visible: false, hp: 0, max: BOSS_MAX, distance: 0, inRange: false, cooling: false, weapon: selected, note: '' }
  const listeners = new Set<() => void>()
  let key = '', gone = false, lastAttack = -Infinity, note = '', noteUntil = 0
  let lastBoss = '', lastHp = 0, hitFlash = 0, deadAt = 0, spawnAt = -Infinity, poseOn = false
  const arena = BOSS_ARENAS[room]
  const textureCache = new Map<string, THREE.Texture>()
  const texture = (src: string) => { if (!textureCache.has(src)) textureCache.set(src, w.texOf(assetUrl(src))); return textureCache.get(src)! }
  const boss = w.paperDoll(texture('travel/monster/dino_angry.webp'), 6.5, 0.92)
  boss.root.position.set(arena.x, 0, arena.z)
  boss.root.visible = false
  // 본체와 클릭 판정은 같은 물체다. 보스를 누르면 사거리까지 가거나 공격한다.
  boss.root.userData.onPick = () => { if (state.inRange) api.attack(); else api.approach() }
  const obstacle = { x: arena.x, z: arena.z, r: 2.1 }
  let colliding = false
  const hpCanvas = document.createElement('canvas'); hpCanvas.width = 512; hpCanvas.height = 112
  const hpTex = w.texOf(hpCanvas)
  const hpLabel = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ map: hpTex, transparent: true, depthTest: false })))
  hpLabel.scale.set(5.5, 1.2, 1); hpLabel.position.set(arena.x, 7.1, arena.z); hpLabel.renderOrder = 12
  hpLabel.visible = false; w.scene.add(hpLabel)
  const drawHp = (hp: number, max: number) => {
    const g = hpCanvas.getContext('2d')!
    g.clearRect(0, 0, 512, 112)
    g.fillStyle = '#ffffffee'; g.beginPath(); g.roundRect(4, 4, 504, 104, 24); g.fill()
    g.font = 'bold 29px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#7a3d8f'; g.fillText(hp > 0 ? `👑 대형 몬스터 ${hp} / ${max}` : '🎉 함께 물리쳤어요!', 256, 43)
    g.fillStyle = '#ead9ee'; g.fillRect(28, 65, 456, 24)
    g.fillStyle = '#f780a9'; g.fillRect(28, 65, 456 * hp / max, 24)
    hpTex.needsUpdate = true
  }
  const spark = w.texOf(emojiCanvas('✨'))
  const slashCanvas = document.createElement('canvas'); slashCanvas.width = slashCanvas.height = 128
  const sg = slashCanvas.getContext('2d')!
  sg.strokeStyle = '#fff8b0'; sg.lineWidth = 13; sg.shadowColor = '#ff84ba'; sg.shadowBlur = 16
  sg.beginPath(); sg.arc(64, 64, 40, -1.3, 1.3); sg.stroke()
  const slash = w.texOf(slashCanvas)
  // 고정 크기 풀을 재사용해 오래 싸워도 효과 오브젝트가 계속 쌓이지 않는다.
  const effects: Effect[] = Array.from({ length: 40 }, () => {
    const sprite = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ map: spark, transparent: true, depthWrite: false })))
    sprite.visible = false; w.scene.add(sprite)
    return { sprite, from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, life: 0, hit: null, sword: false }
  })
  const hands = new Map<string, Hand>()
  const seenAttacks = new Map<string, number>()
  const makeHand = (id: string, x: number, z: number) => {
    const sprite = new THREE.Sprite(w.keep(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })))
    sprite.renderOrder = 10; w.scene.add(sprite)
    const h: Hand = { sprite, x, z, swingAt: -Infinity, weapon: selected }
    hands.set(id, h); return h
  }
  const to = new THREE.Vector3(arena.x, 3, arena.z)
  const launch = (hand: Hand, own: boolean, bossId: string, at: number) => {
    hand.swingAt = performance.now()
    const fx = effects.find(f => !f.sprite.visible)
    if (!fx) return false
    fx.sword = hand.weapon.sword
    fx.from.set(hand.x, 1.2, hand.z); fx.to.copy(to)
    fx.age = 0; fx.life = hand.weapon.sword ? 0.22 : Math.min(0.65, 0.18 + fx.from.distanceTo(to) * 0.025)
    fx.sprite.material.map = hand.weapon.sword ? slash : spark
    fx.sprite.material.needsUpdate = true; fx.sprite.material.opacity = 1
    fx.sprite.scale.setScalar(hand.weapon.sword ? 2.1 : 0.65)
    fx.sprite.visible = true
    const power = hand.weapon.power
    fx.hit = own ? () => {
      const mp = getMp()
      if (!gone && mp.status === 'on' && mp.room === room && !mp.visiting && mp.boss?.id === bossId && mp.boss.hp > 0) hitBoss(bossId, power)
    } : null
    seenAttacks.set(`${own ? 'me' : hand.sprite.uuid}|${at}`, serverNow())
    return true
  }
  const api: BossBattle = {
    weapons,
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn) } },
    getSnapshot: () => state,
    equip: id => {
      const next = weapons.find(weapon => weapon.id === id)
      if (!next || gone) return
      selected = next
      if (getMp().status === 'on' && !getMp().visiting) setBattlePose(selected.id)
      try { localStorage.setItem('ryuso.boss.weapon', id) } catch { /* 이번만 */ }
    },
    approach: () => {
      if (!state.visible || state.hp <= 0) return
      const distance = selected.sword ? 3.4 : 7
      w.walkTo(arena.x, arena.z, () => { w.me.moving = false }, distance)
    },
    attack: () => {
      const mp = getMp(), now = performance.now(), distance = Math.hypot(w.me.x - arena.x, w.me.z - arena.z)
      if (mp.status !== 'on' || mp.room !== room || mp.visiting || !mp.boss || gone) return
      if (!canStrikeBoss(mp.boss, distance, selected, now, lastAttack)) {
        if (distance > selected.range) { note = selected.sword ? '검이 닿도록 가까이 가요' : '조금 더 가까이 가요'; noteUntil = now + 1800; api.approach() }
        return
      }
      const h = hands.get('me') ?? makeHand('me', w.me.x, w.me.z)
      h.x = w.me.x; h.z = w.me.z; h.weapon = selected
      const at = serverNow()
      if (!launch(h, true, mp.boss.id, at)) return
      lastAttack = now
      setBattlePose(selected.id, encodeBattleAttack({ bossId: mp.boss.id, at, sword: selected.sword, room }))
      playTap()
    },
    dispose: () => {
      gone = true
      for (const o of [boss.root, hpLabel, ...effects.map(f => f.sprite), ...[...hands.values()].map(h => h.sprite)]) w.scene.remove(o)
      const index = w.pickables.indexOf(boss.root); if (index >= 0) w.pickables.splice(index, 1)
      const oi = w.obstacles.indexOf(obstacle); if (oi >= 0) w.obstacles.splice(oi, 1)
      for (const fx of effects) fx.hit = null
      if (poseOn) setBattlePose(null)
      listeners.clear()
    },
  }
  w.onFrame((dt, now) => {
    if (gone) return
    const mp = getMp(), active = mp.status === 'on' && mp.room === room && !mp.visiting
    if (active && !poseOn) { poseOn = true; setBattlePose(selected.id) }
    if (!active && poseOn) { poseOn = false; setBattlePose(null) }
    if (active && bossCanRespawn(mp.boss, serverNow()) && now - spawnAt > 3000) {
      spawnAt = now
      spawnBoss({ id: Math.random().toString(36).slice(2, 10), type: Math.floor(Math.random() * BOSS_MONSTERS.length), x: 0, z: 0, hp: BOSS_MAX, max: BOSS_MAX })
    }
    const b = active ? mp.boss : null
    const visible = !!b && (b.hp > 0 || serverNow() - b.t < 6000)
    boss.root.visible = visible; hpLabel.visible = visible
    if (!active) for (const fx of effects) { fx.sprite.visible = false; fx.hit = null }
    // 가까운 전투에서는 몬스터 머리와 플레이어가 함께 보이도록 시선만 조금 높인다.
    if (visible && Math.hypot(w.me.x - arena.x, w.me.z - arena.z) < 18 && w.camera.position.y < 30) {
      w.camera.lookAt(w.me.x * 0.6 + arena.x * 0.4, 2.6, w.me.z * 0.6 + arena.z * 0.4)
    }
    if (visible && !colliding && b!.hp > 0) { colliding = true; w.obstacles.push(obstacle); w.pickables.push(boss.root) }
    if ((!visible || b!.hp <= 0) && colliding) {
      colliding = false
      w.obstacles.splice(w.obstacles.indexOf(obstacle), 1)
      w.pickables.splice(w.pickables.indexOf(boss.root), 1)
    }
    if (b && visible) {
      if (lastBoss !== b.id) { lastBoss = b.id; lastHp = b.hp; deadAt = 0; drawHp(b.hp, b.max) }
      if (lastHp !== b.hp) {
        hitFlash = now; drawHp(b.hp, b.max)
        if (b.hp === 0) { deadAt = now; playBell() }
        lastHp = b.hp
      }
      const mon = BOSS_MONSTERS[b.type % BOSS_MONSTERS.length]
      const mat = boss.doll.material as THREE.MeshBasicMaterial
      const next = texture(`travel/monster/${mon}_${b.hp > 0 ? 'angry' : 'happy'}.webp`)
      if (mat.map !== next) { mat.map = next; mat.needsUpdate = true }
      w.face(boss, 1)
      const hit = now - hitFlash < 250
      boss.body.position.set(hit ? Math.sin(now * 0.06) * 0.18 : 0, Math.abs(Math.sin(now * 0.002)) * (b.hp ? 0.12 : 0.3), 0)
      mat.color.setHex(hit ? 0xffb4d1 : 0xffffff)
      if (deadAt && now - deadAt < 1200) boss.body.rotation.y += Math.sin((now - deadAt) / 1200 * Math.PI) * Math.PI * 2
    }
    const known = new Set<string>()
    const local = hands.get('me') ?? makeHand('me', w.me.x, w.me.z)
    local.x = w.me.x; local.z = w.me.z; local.weapon = selected; known.add('me')
    if (active && b && visible) for (const [uid, player] of Object.entries(mp.players)) {
      if (uid === mp.uid || player.room !== room) continue
      const weaponId = player.look.outfit[BATTLE_WEAPON_SLOT]
      if (!weaponId) continue
      known.add(uid)
      const hand = hands.get(uid) ?? makeHand(uid, player.x, player.z)
      hand.x += (player.x - hand.x) * follow(dt, 8); hand.z += (player.z - hand.z) * follow(dt, 8)
      hand.weapon = battleWeapon(weaponId)
      const attack = freshBattleAttack(player, b.id, room, serverNow())
      const eventKey = attack ? `${uid}|${attack.at}` : ''
      if (attack && !seenAttacks.has(eventKey)) {
        seenAttacks.set(eventKey, serverNow())
        launch(hand, false, b.id, attack.at)
      }
    }
    for (const [uid, hand] of hands) {
      const near = Math.hypot(hand.x - arena.x, hand.z - arena.z) < 18
      hand.sprite.visible = active && !!b && visible && known.has(uid) && near
      if (!hand.sprite.visible) continue
      const textureMap = texture(hand.weapon.img)
      if (hand.sprite.material.map !== textureMap) { hand.sprite.material.map = textureMap; hand.sprite.material.needsUpdate = true }
      const a = Math.atan2(w.camera.position.x - hand.x, w.camera.position.z - hand.z), swing = Math.max(0, 1 - (now - hand.swingAt) / 300)
      hand.sprite.position.set(hand.x + Math.cos(a) * 0.45 + Math.sin(a) * 0.15, 1, hand.z - Math.sin(a) * 0.45 + Math.cos(a) * 0.15)
      hand.sprite.center.set(hand.weapon.sword ? 0.85 : 0.4, hand.weapon.sword ? 0.87 : 0.18)
      hand.sprite.scale.set(hand.weapon.sword ? 0.95 * hand.weapon.aspect : 1.05, hand.weapon.sword ? 0.95 : 1.05, 1)
      hand.sprite.material.rotation = hand.weapon.sword ? -2.2 - Math.sin(swing * Math.PI) : 0.3 + Math.sin(swing * Math.PI)
    }
    for (const [uid, hand] of hands) if (!known.has(uid)) { w.scene.remove(hand.sprite); hands.delete(uid) }
    for (const fx of effects) if (fx.sprite.visible) {
      fx.age += dt
      if (fx.age >= fx.life) { fx.sprite.visible = false; const hit = fx.hit; fx.hit = null; hit?.(); continue }
      const t = fx.age / fx.life
      if (fx.sword) { fx.sprite.position.copy(fx.to); fx.sprite.material.rotation = t * 1.4; fx.sprite.material.opacity = 1 - t }
      else { fx.sprite.position.lerpVectors(fx.from, fx.to, t); fx.sprite.position.y += Math.sin(t * Math.PI) * 0.8; fx.sprite.material.rotation = t * 5 }
    }
    for (const [id, stamp] of seenAttacks) if (serverNow() - stamp > 5000) seenAttacks.delete(id)
    const distance = Math.ceil(Math.hypot(w.me.x - arena.x, w.me.z - arena.z))
    const inRange = !!b && b.hp > 0 && Math.hypot(w.me.x - arena.x, w.me.z - arena.z) <= selected.range
    const cooling = now - lastAttack < selected.cooldown
    const currentNote = noteUntil > now ? note : ''
    const nextKey = `${visible}|${b?.hp}|${distance}|${inRange}|${cooling}|${selected.id}|${currentNote}`
    if (nextKey !== key) {
      key = nextKey
      state = { visible, hp: b?.hp ?? 0, max: b?.max ?? BOSS_MAX, distance, inRange, cooling, weapon: selected, note: currentNote }
      for (const fn of listeners) fn()
    }
  })
  return api
}
