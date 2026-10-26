/**
 * 축구: 빨강 팀(0, 왼쪽 골대를 지키고 오른쪽으로 공격) vs 보라 팀(1). 팀마다 아바타 1명(사람이 움직임) + 동물 친구 4명(골키퍼 1, 필드 3).
 * 경기장은 가로 100 × 세로 60 단위. 공에 닿으면 저절로 상대 골대 쪽으로 찬다(아이가 하기 쉽게). 순수 함수라 테스트할 수 있다.
 */
export const FW = 100
export const FH = 60
export const GOAL_TOP = 22
export const GOAL_BOT = 38
export const MATCH_SECONDS = 120
const AVATAR_SPEED = 24
const ANIMAL_SPEED = 13
const KEEPER_SPEED = 11
const REACH = 5
/** 슛 버튼 세기(보통 차기 52 보다 세게) */
const SHOOT_POWER = 72
/** 1인 게임에서 컴퓨터가 움직이는 상대 아바타 빠르기(사람보다 조금 느리게) */
const CPU_SPEED = 17
/** 몸이 겹치지 않는 거리: SEP_X·SEP_Y 안으로는 들어오지 못한다(그림 폭에 맞춤. 세로 화면은 경기장을 세워 그려서 가로·세로를 같게) */
const SEP_X = 7.5
const SEP_Y = 7.5
const FRICTION = 1.1

export type Team = 0 | 1
export interface Vec { x: number; y: number }
export interface Player {
  team: Team
  /** 아바타는 아바타 id, 동물은 카페 동물 번호 */
  who: string | number
  role: 'human' | 'keeper' | 'field'
  home: Vec
  x: number
  y: number
  /** 마지막으로 움직인 가로 방향(그림 뒤집기) */
  dir: 1 | -1
  /** 다시 찰 수 있을 때까지 남은 초 */
  cd: number
  /** 마지막으로 움직인 방향(드리블할 때 공이 이쪽 발 앞에 붙는다) */
  mx: number
  my: number
  /** 동물마다 다른 버릇: 빠르기 배율, 공을 따라가는 정도, 어슬렁거리는 크기·빠르기·시작점 */
  trait: { speed: number; follow: number; wander: number; freq: number; phase: number }
}
export interface Match {
  players: Player[]
  ball: Vec & { vx: number; vy: number }
  score: [number, number]
  time: number
  /** 골이 들어간 뒤 잠깐 멈춰 있는 시간 */
  pause: number
  over: boolean
  /** 그 팀 아바타를 컴퓨터가 움직이나(1인 게임에서 보라 팀) */
  cpu: [boolean, boolean]
  /** 팀마다 지금 공을 쫓는 동물(players 번호). 조금 더 가까운 친구가 생겨도 바로 바꾸지 않아 우왕좌왕하지 않는다 */
  chaser: [number, number]
  /** 사람 아바타가 공을 몰고 가는 중이면 그 선수 번호(-1 이면 아무도) */
  hold: number
  /** 공을 가진 채 멈춰 있던 시간: 잠깐 멈추면 저절로 찬다(버튼을 안 눌러도 되게) */
  holdIdle: number
}
/** 사람이 누르는 버튼: 슛(세게 골대로), 패스(같은 팀 동물에게) */
export type Act = 'shoot' | 'pass'
/** 공을 몰다가 이만큼 멈춰 있으면 저절로 찬다 */
export const DRIBBLE_IDLE = 0.5
/** 공을 몰 때는 조금 느리게(상대가 뺏을 수 있게). 혼자 하기에서는 컴퓨터 팀 힘이 셀수록(아이가 앞설수록) 더 느리게 */
const DRIBBLE_SPEED = 0.6
/** 공을 몰고 있을 때 상대가 이 거리 안에 있으면 1초에 STEAL_RATE 번꼴로 뺏긴다 */
const STEAL_R = REACH + 3
const STEAL_RATE = 3
/** 공이 이보다 빠르면 사람 아바타가 잡지 못한다 */
const TRAP_SPEED = 30
/** 슛·패스 버튼이 먹는 거리(공에서) */
export const ACT_REACH = REACH + 2.5

const mirror = (v: Vec, team: Team): Vec => (team === 0 ? v : { x: FW - v.x, y: v.y })
/** 팀 0 기준 자리(팀 1 은 좌우 반대): 골키퍼, 수비 둘, 미드필더, 아바타 */
const HOMES = { keeper: { x: 4, y: 30 }, field: [{ x: 20, y: 17 }, { x: 20, y: 43 }, { x: 33, y: 30 }], human: { x: 42, y: 30 } }

/** 혼자 하는 게임: 한 팀만 컴퓨터 */
export const vsCpu = (m: Pick<Match, 'cpu'>) => m.cpu[0] !== m.cpu[1]
/** 비겼을 때 골든골로 더 하는 최대 시간 */
export const GOLDEN_SECONDS = 45
/**
 * 혼자 하는 게임에서 컴퓨터 팀의 힘(빠르기 배율). 사람 팀이 지고 있으면 약해지고, 많이 이기고 있으면 조금 세져서
 * 아이가 대체로(10판에 7판쯤) 이기되 늘 이기지는 않게 한다(아이 흉내 선수로 여러 판 돌려 맞춘 값, soccer.test.ts)
 */
export function cpuStrength(m: Pick<Match, 'cpu' | 'score' | 'time'>, team: Team): number {
  if (!vsCpu(m) || !m.cpu[team]) return 1
  const lead = m.score[team === 0 ? 1 : 0] - m.score[team] // 사람 팀이 앞선 골 수
  const base = lead <= -1 ? CPU_LOSING : lead === 0 ? (m.time >= MATCH_SECONDS ? CPU_GOLDEN : CPU_EVEN) : lead === 1 ? CPU_AHEAD1 : CPU_AHEAD2
  return base
}
const AIM_K = 2
const CPU_LOSING = 0.45, CPU_EVEN = 1, CPU_GOLDEN = 0.45, CPU_AHEAD1 = 1.6, CPU_AHEAD2 = 1.9

export function newMatch(avatars: [string, string], animals: [number[], number[]], cpu: [boolean, boolean] = [false, false]): Match {
  const players: Player[] = []
  for (const team of [0, 1] as Team[]) {
    const add = (who: string | number, role: Player['role'], home: Vec) => {
      const h = mirror(home, team)
      const k = players.length
      // 번호로 정해지는 버릇(테스트에서도 늘 같다)
      const r = (n: number) => ((Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
      players.push({ team, who, role, home: h, x: h.x, y: h.y, dir: team === 0 ? 1 : -1, cd: 0, mx: team === 0 ? 1 : -1, my: 0, trait: { speed: 0.85 + r(1) * 0.35, follow: 0.25 + r(2) * 0.4, wander: 3 + r(3) * 4, freq: 0.35 + r(4) * 0.5, phase: r(5) * 6.28 } })
    }
    add(avatars[team], 'human', HOMES.human)
    animals[team].slice(0, 4).forEach((a, k) => (k === 0 ? add(a, 'keeper', HOMES.keeper) : add(a, 'field', HOMES.field[k - 1])))
  }
  const firstField = (team: Team) => players.findIndex((p) => p.team === team && p.role === 'field')
  return { players, ball: { x: FW / 2, y: FH / 2, vx: 0, vy: 0 }, score: [0, 0], time: 0, pause: 1.2, over: false, cpu, chaser: [firstField(0), firstField(1)], hold: -1, holdIdle: 0 }
}

const goalOf = (team: Team): Vec => ({ x: team === 0 ? FW : 0, y: FH / 2 }) // team 이 공격하는 골대
const unit = (x: number, y: number) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d } }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** 목표 쪽으로 한 걸음. 실제로 걸었으면 true */
function moveToward(p: Player, t: Vec, speed: number, dt: number): boolean {
  const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy)
  if (d < 0.3) return false
  const s = Math.min(d, speed * dt)
  p.x += (dx / d) * s; p.y += (dy / d) * s
  p.mx = dx / d; p.my = dy / d
  if (Math.abs(dx) > 0.2) p.dir = dx > 0 ? 1 : -1
  return true
}

/** 골 뒤·처음: 모두 제자리, 공은 가운데 */
function resetPositions(m: Match) {
  for (const p of m.players) { p.x = p.home.x; p.y = p.home.y; p.cd = 0 }
  m.ball = { x: FW / 2, y: FH / 2, vx: 0, vy: 0 }
  m.hold = -1; m.holdIdle = 0
}

/**
 * 한 프레임. targets[팀] 은 그 팀 아바타가 가려는 곳(손가락 자리, 없으면 제자리).
 * events: 'kick'(누가 찼다), 'goal0'·'goal1'(그 팀이 넣었다), 'end'
 */
export function stepMatch(m0: Match, dt: number, targets: [Vec | null, Vec | null], rnd: () => number = Math.random, acts: [Act | null, Act | null] = [null, null]): { m: Match; events: string[] } {
  const m: Match = { ...m0, players: m0.players.map((p) => ({ ...p })), ball: { ...m0.ball }, score: [...m0.score] as [number, number], chaser: [...m0.chaser] as [number, number] }
  const events: string[] = []
  if (m.over) return { m, events }
  m.time = Math.min(MATCH_SECONDS + GOLDEN_SECONDS, m.time + dt)
  // 혼자 하는 게임에서 비긴 채로 끝나면 골든골(먼저 넣는 팀이 이김)로 조금 더 한다
  const golden = vsCpu(m) && m.score[0] === m.score[1]
  if (m.time >= (golden ? MATCH_SECONDS + GOLDEN_SECONDS : MATCH_SECONDS)) { m.over = true; events.push('end'); return { m, events } }
  if (golden && m0.time < MATCH_SECONDS && m.time >= MATCH_SECONDS) events.push('golden')
  if (m.pause > 0) { m.pause = Math.max(0, m.pause - dt); return { m, events } }
  const b = m.ball

  const dist = (p: Vec) => Math.hypot(p.x - b.x, p.y - b.y)
  // 이번 프레임에 사람 아바타가 손가락을 따라 스스로 걸었는지(다른 선수에게 밀린 건 빼고): 드리블 중 멈춤을 알아챈다
  const walked = new Set<Player>()
  for (const team of [0, 1] as Team[]) {
    const k = cpuStrength(m, team)
    const own = goalOf(team === 0 ? 1 : 0) // 내가 지키는 골대
    const toGoal = unit(goalOf(team).x - b.x, goalOf(team).y - b.y)
    const fwd = team === 0 ? 1 : -1
    // 공을 쫓는 동물: 지금 쫓는 친구보다 4 이상 더 가까운 친구가 생길 때만 바꾼다
    const fielders = m.players.map((p, i) => ({ p, i })).filter(({ p }) => p.team === team && p.role === 'field')
    const best = fielders.reduce((a, c) => (dist(c.p) < dist(a.p) ? c : a), fielders[0])
    if (dist(best.p) < dist(m.players[m.chaser[team]]) - 4) m.chaser[team] = best.i
    const chaser = m.players[m.chaser[team]]
    // 도와주는 친구: 쫓는 친구 다음으로 가까운 동물이 공보다 앞쪽 빈 곳으로 달려가 기다린다
    const helper = fielders.filter(({ p }) => p !== chaser).sort((a, c) => dist(a.p) - dist(c.p))[0]?.p
    for (const p of m.players.filter((q) => q.team === team)) {
      const t = p.trait
      const wob = { x: Math.sin(m.time * t.freq + t.phase) * t.wander, y: Math.cos(m.time * t.freq * 1.3 + t.phase) * t.wander }
      if (p.role === 'human' && !m.cpu[team]) { const g = targets[team]; if (g && moveToward(p, { x: clamp(g.x, 1, FW - 1), y: clamp(g.y, 1, FH - 1) }, AVATAR_SPEED * (m.hold === m.players.indexOf(p) ? Math.min(1, DRIBBLE_SPEED / cpuStrength(m, team === 0 ? 1 : 0)) : 1), dt)) walked.add(p) }
      else if (p.role === 'human') {
        // 컴퓨터 아바타: 공 뒤로 돌아가 상대 골대 쪽으로 차러 간다
        moveToward(p, { x: b.x - toGoal.x * 2, y: b.y - toGoal.y * 2 }, CPU_SPEED * k, dt)
      } else if (p.role === 'keeper') {
        const near = Math.abs(b.x - own.x) < 14 && b.y > GOAL_TOP - 6 && b.y < GOAL_BOT + 6
        const g = near ? { x: b.x, y: b.y } : { x: p.home.x, y: clamp(b.y, GOAL_TOP + 2, GOAL_BOT - 2) }
        moveToward(p, { x: clamp(g.x, Math.min(own.x, own.x + fwd * 16), Math.max(own.x, own.x + fwd * 16)), y: g.y }, KEEPER_SPEED * k, dt)
      } else if (p === chaser) {
        moveToward(p, { x: b.x - toGoal.x * 2, y: b.y - toGoal.y * 2 }, ANIMAL_SPEED * t.speed * k, dt)
      } else if (p === helper) {
        const side = p.home.y < FH / 2 ? -1 : 1
        moveToward(p, { x: clamp(b.x + fwd * 12 + wob.x * 0.5, 4, FW - 4), y: clamp(b.y + side * 12 + wob.y * 0.5, 4, FH - 4) }, ANIMAL_SPEED * 0.9 * t.speed * k, dt)
      } else {
        // 나머지는 자기 자리 근처에서 저마다 다르게 어슬렁거리며 공 쪽으로 조금씩 따라간다
        moveToward(p, { x: clamp(p.home.x + (b.x - FW / 2) * t.follow + wob.x, 3, FW - 3), y: clamp(p.home.y + (b.y - FH / 2) * t.follow * 0.6 + wob.y, 3, FH - 3) }, ANIMAL_SPEED * 0.7 * t.speed * k, dt)
      }
    }
  }
  // 서로 겹치지 않게 살짝 밀어낸다
  // (지금 자리를 기준으로 한꺼번에 밀어서 배열 순서와 상관없게)
  // 여러 명이 몰려 있으면 한 번에 다 안 풀려서 여섯 번 되풀이한다
  for (let round = 0; round < 6; round++) {
  const shove = m.players.map(() => ({ x: 0, y: 0 }))
  for (let i = 0; i < m.players.length; i++) for (let j = i + 1; j < m.players.length; j++) {
    const a = m.players[i], c = m.players[j], dx = c.x - a.x, dy = c.y - a.y
    // 타원 거리(가로 SEP_X·세로 SEP_Y)가 1 보다 가까우면 그 밖으로 반씩 밀어낸다: 그림끼리 몸이 겹치지 않게
    const e = Math.hypot(dx / SEP_X, dy / SEP_Y)
    if (e < 1) {
      const d = Math.hypot(dx, dy), ux = d > 0.01 ? dx / d : (i % 2 ? 1 : -1), uy = d > 0.01 ? dy / d : 0
      const r = 1 / Math.hypot(ux / SEP_X, uy / SEP_Y) // 이 방향으로 타원 끝까지의 거리
      const push = (r - d) / 2
      shove[i].x -= ux * push; shove[i].y -= uy * push; shove[j].x += ux * push; shove[j].y += uy * push
    }
  }
  m.players.forEach((p, i) => { p.x += shove[i].x; p.y += shove[i].y })
  }
  for (const p of m.players) { p.x = clamp(p.x, 0.5, FW - 0.5); p.y = clamp(p.y, 0.5, FH - 0.5); p.cd = Math.max(0, p.cd - dt) }

  // 공에 닿으면 저절로 찬다: 상대 골대 쪽으로(동물은 조금 빗나가게)
  /** 공을 찬다: 방향(단위 벡터)과 세기 */
  const strike = (p: Player, d: Vec, power: number, ev: string) => {
    b.vx = d.x * power; b.vy = d.y * power
    p.cd = 0.45
    m.hold = -1; m.holdIdle = 0
    events.push(ev)
  }
  /** 상대 골대 쪽 보통 차기(닿으면 저절로 차기·드리블하다 멈췄을 때) */
  const autoKick = (p: Player) => {
    const g = goalOf(p.team)
    // 혼자 하는 게임: 사람이 앞서 있을수록 슛이 조금씩 빗나가고(컴퓨터 팀 힘 k 가 클수록), 컴퓨터 팀은 세게 찬다
    const other = cpuStrength(m, p.team === 0 ? 1 : 0), mineK = cpuStrength(m, p.team)
    const aimY = g.y + (rnd() - 0.5) * (p.role === 'human' && !m.cpu[p.team] ? 8 * (vsCpu(m) ? other * other * AIM_K : 1) : 18)
    let d = unit(g.x - b.x, aimY - b.y)
    if (p.role !== 'human') { const a = (rnd() - 0.5) * 0.5, c = Math.cos(a), s = Math.sin(a); d = { x: d.x * c - d.y * s, y: d.x * s + d.y * c } }
    strike(p, d, (p.role === 'human' ? (m.cpu[p.team] ? 42 : 52) : p.role === 'keeper' ? 46 : 36) * Math.sqrt(mineK), 'kick')
  }

  // 슛·패스 버튼: 공을 몰고 있거나 공 가까이 있으면
  for (const team of [0, 1] as Team[]) {
    const act = acts[team]
    const hi = m.players.findIndex((p) => p.team === team && p.role === 'human')
    const h = m.players[hi]
    if (!act || m.cpu[team] || !(m.hold === hi || (h.cd <= 0 && dist(h) <= ACT_REACH))) continue
    if (act === 'shoot') {
      const g = goalOf(team), other = cpuStrength(m, team === 0 ? 1 : 0)
      const aimY = g.y + (rnd() - 0.5) * 6 * (vsCpu(m) ? other * other * AIM_K : 1)
      strike(h, unit(g.x - b.x, aimY - b.y), SHOOT_POWER, 'shoot')
    } else {
      // 패스: 나보다 상대 골대 쪽(앞)에 있는 같은 팀 동물에게만, 그 자리에서 멈추게 굴려 준다.
      // 앞에 아무도 없으면 우리 편 골대 쪽(뒤)으로 주지 않고, 상대 골대 쪽 빈 곳으로 앞으로 굴려 준다(동물 친구가 달려가 받는다)
      const fwd = team === 0 ? 1 : -1
      const ahead = m.players.filter((p) => p.team === team && p.role === 'field' && (p.x - b.x) * fwd > 3)
      const score = (p: Vec) => (p.x - b.x) * fwd - Math.hypot(p.x - b.x, p.y - b.y) * 0.35
      const to: Vec = ahead.length ? ahead.reduce((a, p) => (score(p) > score(a) ? p : a)) : { x: clamp(b.x + fwd * 18, 2, FW - 2), y: b.y + (FH / 2 - b.y) * 0.3 }
      const d = Math.hypot(to.x - b.x, to.y - b.y)
      strike(h, unit(to.x - b.x, to.y - b.y), Math.max(18, d * FRICTION * 1.05), 'pass')
    }
  }

  // 드리블: 사람 아바타가 공을 가지면 공이 움직이는 쪽 발 앞에 붙어 다닌다. 잠깐 멈추면 저절로 찬다
  if (m.hold >= 0) {
    const p = m.players[m.hold]
    m.holdIdle = walked.has(p) ? 0 : m.holdIdle + dt
    b.x = p.x + p.mx * 2.6; b.y = p.y + p.my * 2.6 + 0.6; b.vx = 0; b.vy = 0
    if (m.holdIdle >= DRIBBLE_IDLE) autoKick(p)
  }

  // 공에 닿은 사람 중 한 명만 찬다(배열 순서에 따라 한 팀이 늘 먼저 차지 않게)
  // 여러 명이 닿아 있으면(양 팀이 공 앞뒤에 같은 거리로 붙는 일이 많다) 무작위로 한 명.
  // 공을 몰고 있는 동안에는 상대만 뺏을 수 있다(같은 팀 동물은 건드리지 않는다)
  let holder = m.hold >= 0 ? m.players[m.hold] : null
  // 공을 몰고 있을 때 상대가 가까이(STEAL_R) 붙어 있으면 조금씩 확률로 뺏는다(혼자 하기는 컴퓨터 팀 힘만큼 더 자주)
  if (holder) {
    const ht = holder.team
    const thief = m.players.find((p) => p.team !== ht && p.cd <= 0 && dist(p) <= STEAL_R)
    if (thief && rnd() < dt * STEAL_RATE * cpuStrength(m, thief.team)) { events.push('steal'); autoKick(thief); holder = null }
  }
  // 사람 아바타는 빠르게 날아오는 공은 못 잡는다(그냥 지나간다): 컴퓨터 팀의 슛이 막히지만 않게
  const fast = Math.hypot(b.vx, b.vy) > TRAP_SPEED
  const near = m.players.filter((p) => p.cd <= 0 && dist(p) <= REACH && p !== holder && (!holder || p.team !== holder.team) && !(fast && p.role === 'human' && !m.cpu[p.team]))
  const kicker = near.length ? near[Math.floor(rnd() * near.length)] : undefined
  if (kicker && kicker.role === 'human' && !m.cpu[kicker.team]) { m.hold = m.players.indexOf(kicker); m.holdIdle = 0; events.push('trap') } // 사람은 차지 않고 공을 잡아 몬다
  else if (kicker) { if (holder) events.push('steal'); autoKick(kicker) }

  // 공 움직이기: 미끄러지다 멈추고, 옆줄·골대 옆 벽에 튕긴다(몰고 있는 공은 발 앞에 붙어 있다)
  if (m.hold < 0) { b.x += b.vx * dt; b.y += b.vy * dt }
  const f = Math.exp(-FRICTION * dt); b.vx *= f; b.vy *= f
  if (b.y < 1) { b.y = 1; b.vy = Math.abs(b.vy) } else if (b.y > FH - 1) { b.y = FH - 1; b.vy = -Math.abs(b.vy) }
  const inMouth = b.y > GOAL_TOP && b.y < GOAL_BOT
  if (b.x < 0 || b.x > FW) {
    if (inMouth) {
      const scorer: Team = b.x > FW ? 0 : 1
      m.score[scorer]++
      events.push(`goal${scorer}`)
      if (m.time >= MATCH_SECONDS) { m.over = true; events.push('end'); return { m, events } } // 골든골
      resetPositions(m)
      m.pause = 1.6
    } else if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) } else { b.x = FW; b.vx = -Math.abs(b.vx) }
  }
  return { m, events }
}

/** 동물 8마리를 4마리씩 두 팀으로(섞기) */
export function splitAnimals(rnd: () => number = Math.random, n = 8): [number[], number[]] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return [a.slice(0, n / 2), a.slice(n / 2)]
}
