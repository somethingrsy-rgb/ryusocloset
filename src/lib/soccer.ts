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
const REACH = 2.8
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
}
export interface Match {
  players: Player[]
  ball: Vec & { vx: number; vy: number }
  score: [number, number]
  time: number
  /** 골이 들어간 뒤 잠깐 멈춰 있는 시간 */
  pause: number
  over: boolean
}

const mirror = (v: Vec, team: Team): Vec => (team === 0 ? v : { x: FW - v.x, y: v.y })
/** 팀 0 기준 자리(팀 1 은 좌우 반대): 골키퍼, 수비 둘, 미드필더, 아바타 */
const HOMES = { keeper: { x: 4, y: 30 }, field: [{ x: 20, y: 17 }, { x: 20, y: 43 }, { x: 33, y: 30 }], human: { x: 42, y: 30 } }

export function newMatch(avatars: [string, string], animals: [number[], number[]]): Match {
  const players: Player[] = []
  for (const team of [0, 1] as Team[]) {
    const add = (who: string | number, role: Player['role'], home: Vec) => {
      const h = mirror(home, team)
      players.push({ team, who, role, home: h, x: h.x, y: h.y, dir: team === 0 ? 1 : -1, cd: 0 })
    }
    add(avatars[team], 'human', HOMES.human)
    animals[team].slice(0, 4).forEach((a, k) => (k === 0 ? add(a, 'keeper', HOMES.keeper) : add(a, 'field', HOMES.field[k - 1])))
  }
  return { players, ball: { x: FW / 2, y: FH / 2, vx: 0, vy: 0 }, score: [0, 0], time: 0, pause: 1.2, over: false }
}

const goalOf = (team: Team): Vec => ({ x: team === 0 ? FW : 0, y: FH / 2 }) // team 이 공격하는 골대
const unit = (x: number, y: number) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d } }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function moveToward(p: Player, t: Vec, speed: number, dt: number) {
  const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy)
  if (d < 0.3) return
  const s = Math.min(d, speed * dt)
  p.x += (dx / d) * s; p.y += (dy / d) * s
  if (Math.abs(dx) > 0.2) p.dir = dx > 0 ? 1 : -1
}

/** 골 뒤·처음: 모두 제자리, 공은 가운데 */
function resetPositions(m: Match) {
  for (const p of m.players) { p.x = p.home.x; p.y = p.home.y; p.cd = 0 }
  m.ball = { x: FW / 2, y: FH / 2, vx: 0, vy: 0 }
}

/**
 * 한 프레임. targets[팀] 은 그 팀 아바타가 가려는 곳(손가락 자리, 없으면 제자리).
 * events: 'kick'(누가 찼다), 'goal0'·'goal1'(그 팀이 넣었다), 'end'
 */
export function stepMatch(m0: Match, dt: number, targets: [Vec | null, Vec | null], rnd: () => number = Math.random): { m: Match; events: string[] } {
  const m: Match = { ...m0, players: m0.players.map((p) => ({ ...p })), ball: { ...m0.ball }, score: [...m0.score] as [number, number] }
  const events: string[] = []
  if (m.over) return { m, events }
  m.time = Math.min(MATCH_SECONDS, m.time + dt)
  if (m.time >= MATCH_SECONDS) { m.over = true; events.push('end'); return { m, events } }
  if (m.pause > 0) { m.pause = Math.max(0, m.pause - dt); return { m, events } }
  const b = m.ball

  for (const team of [0, 1] as Team[]) {
    const mine = m.players.filter((p) => p.team === team)
    const own = goalOf(team === 0 ? 1 : 0) // 내가 지키는 골대
    const toGoal = unit(goalOf(team).x - b.x, goalOf(team).y - b.y)
    // 공에 가장 가까운 필드 동물이 공을 쫓는다(공 뒤로 돌아가 상대 골대 쪽으로 차게)
    const fielders = mine.filter((p) => p.role === 'field')
    const chaser = fielders.reduce((a, p) => (Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y) ? p : a), fielders[0])
    for (const p of mine) {
      if (p.role === 'human') { const t = targets[team]; if (t) moveToward(p, { x: clamp(t.x, 1, FW - 1), y: clamp(t.y, 1, FH - 1) }, AVATAR_SPEED, dt) }
      else if (p.role === 'keeper') {
        const near = Math.abs(b.x - own.x) < 14 && b.y > GOAL_TOP - 6 && b.y < GOAL_BOT + 6
        const t = near ? { x: b.x, y: b.y } : { x: p.home.x, y: clamp(b.y, GOAL_TOP + 2, GOAL_BOT - 2) }
        moveToward(p, { x: clamp(t.x, Math.min(own.x, own.x + (team === 0 ? 16 : -16)), Math.max(own.x, own.x + (team === 0 ? 16 : -16))), y: t.y }, KEEPER_SPEED, dt)
      } else if (p === chaser) {
        moveToward(p, { x: b.x - toGoal.x * 1.6, y: b.y - toGoal.y * 1.6 }, ANIMAL_SPEED, dt)
      } else {
        // 나머지는 자기 자리를 지키며 공 쪽으로 조금씩 따라간다
        moveToward(p, { x: clamp(p.home.x + (b.x - FW / 2) * 0.45, 3, FW - 3), y: clamp(p.home.y + (b.y - FH / 2) * 0.35, 3, FH - 3) }, ANIMAL_SPEED * 0.8, dt)
      }
    }
  }
  // 서로 겹치지 않게 살짝 밀어낸다
  // (지금 자리를 기준으로 한꺼번에 밀어서 배열 순서와 상관없게)
  const shove = m.players.map(() => ({ x: 0, y: 0 }))
  for (let i = 0; i < m.players.length; i++) for (let j = i + 1; j < m.players.length; j++) {
    const a = m.players[i], c = m.players[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy)
    if (d > 0 && d < 3.2) { const push = (3.2 - d) / 2, ux = dx / d, uy = dy / d; shove[i].x -= ux * push; shove[i].y -= uy * push; shove[j].x += ux * push; shove[j].y += uy * push }
  }
  m.players.forEach((p, i) => { p.x += shove[i].x; p.y += shove[i].y })
  for (const p of m.players) { p.x = clamp(p.x, 0.5, FW - 0.5); p.y = clamp(p.y, 0.5, FH - 0.5); p.cd = Math.max(0, p.cd - dt) }

  // 공에 닿으면 저절로 찬다: 상대 골대 쪽으로(동물은 조금 빗나가게)
  // 공에 닿은 사람 중 한 명만 찬다(배열 순서에 따라 한 팀이 늘 먼저 차지 않게)
  // 여러 명이 닿아 있으면(양 팀이 공 앞뒤에 같은 거리로 붙는 일이 많다) 무작위로 한 명
  const near = m.players.filter((p) => p.cd <= 0 && Math.hypot(p.x - b.x, p.y - b.y) <= REACH)
  const kicker = near.length ? near[Math.floor(rnd() * near.length)] : undefined
  for (const p of kicker ? [kicker] : []) {
    const g = goalOf(p.team)
    const aimY = g.y + (rnd() - 0.5) * (p.role === 'human' ? 8 : 18)
    let d = unit(g.x - b.x, aimY - b.y)
    if (p.role !== 'human') { const a = (rnd() - 0.5) * 0.5, c = Math.cos(a), s = Math.sin(a); d = { x: d.x * c - d.y * s, y: d.x * s + d.y * c } }
    const power = p.role === 'human' ? 52 : p.role === 'keeper' ? 46 : 36
    b.vx = d.x * power; b.vy = d.y * power
    p.cd = 0.45
    events.push('kick')
    break
  }

  // 공 움직이기: 미끄러지다 멈추고, 옆줄·골대 옆 벽에 튕긴다
  b.x += b.vx * dt; b.y += b.vy * dt
  const f = Math.exp(-FRICTION * dt); b.vx *= f; b.vy *= f
  if (b.y < 1) { b.y = 1; b.vy = Math.abs(b.vy) } else if (b.y > FH - 1) { b.y = FH - 1; b.vy = -Math.abs(b.vy) }
  const inMouth = b.y > GOAL_TOP && b.y < GOAL_BOT
  if (b.x < 0 || b.x > FW) {
    if (inMouth) {
      const scorer: Team = b.x > FW ? 0 : 1
      m.score[scorer]++
      events.push(`goal${scorer}`)
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
