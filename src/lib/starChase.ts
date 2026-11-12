/**
 * 도망간 별을 잡아라: 규칙(순수 함수). 화면·네트워크와 분리되어 있다.
 * 별은 가까이 오는 친구에게서 도망가고, 서로 반대편(110도 이상)에서 2.8 안으로 다가오면 당황해서(CORNERED) 느려진다.
 * 판 상태(별 움직임·포획 판정)는 방장 한 곳에서만 돌린다.
 */
export const CFG = {
  w: 24, h: 18, // 플레이 영역(월드 유닛), 가운데가 (0,0)
  avatarR: 0.4, walk: 3.2,
  starR: 0.35, wander: 0.8, flee: 1.7, cornered: 0.3, // 쉽게: 내 걷기(3.2)보다 훨씬 느리게
  fleeIn: 3, fleeOut: 4, fleeHold: 0.5, // 4 안에 들어오면 도주, 5 밖으로 0.5초 벗어나야 풀림
  edge: 1.2,
  surroundDist: 4, surroundDeg: 90, surroundOn: 0.2, surroundMin: 2, surroundOff: 0.5, // 쉽게: 더 멀리서, 더 넓은 각도로도 포위 인정
  catchR: 1.8, catchCd: 0.8,
  maxActive: 3, respawn: 2, spawnFromPlayer0: 4, spawnFromPlayer: 2,
  seconds: 240, target: { 2: 4, 3: 6, 4: 8 } as Record<number, number>,
}
export const targetFor = (n: number) => CFG.target[Math.max(2, Math.min(4, n))]

export interface P2 { x: number; y: number }
export type Mode = 'wander' | 'flee' | 'cornered'
export interface Star { id: number; x: number; y: number; mode: Mode; dx: number; dy: number; turn: number; sAcc: number; nsAcc: number; hold: number; calm: number }
export interface Who extends P2 { uid: string; on: boolean } // on: 연결되어 있고 판에 참여 중

const hyp = (x: number, y: number) => Math.hypot(x, y)
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const inField = (p: P2, m = 0) => Math.abs(p.x) <= CFG.w / 2 - m && Math.abs(p.y) <= CFG.h / 2 - m

/** 걷기: 입력 벡터(길이 1 이하로 정규화)만큼 이동하고 경계 안에 가둔다 */
export function stepWalker(p: P2, ix: number, iy: number, dt: number): P2 {
  const l = hyp(ix, iy), k = l > 1 ? 1 / l : 1
  return { x: clamp(p.x + ix * k * CFG.walk * dt, -CFG.w / 2 + CFG.avatarR, CFG.w / 2 - CFG.avatarR), y: clamp(p.y + iy * k * CFG.walk * dt, -CFG.h / 2 + CFG.avatarR, CFG.h / 2 - CFG.avatarR) }
}

/** 별 둘레에서 서로 다른 두 친구가 반대편(각도 ≥ 110°)에서 가까이(≤ 2.8) 있나. 영벡터(겹침)는 제외 */
export function surrounded(s: P2, ps: Who[]): boolean {
  const near = ps.filter((p) => p.on && hyp(p.x - s.x, p.y - s.y) <= CFG.surroundDist && hyp(p.x - s.x, p.y - s.y) > 1e-6)
  const cos = Math.cos((CFG.surroundDeg * Math.PI) / 180)
  for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
    const ax = near[i].x - s.x, ay = near[i].y - s.y, bx = near[j].x - s.x, by = near[j].y - s.y
    const d = clamp((ax * bx + ay * by) / (hyp(ax, ay) * hyp(bx, by)), -1, 1)
    if (d <= cos) return true
  }
  return false
}

/** 잡을 별 하나: 반경 1.2 안에서 가장 가까운 것(같으면 id 순) */
export function pickCatch(stars: Star[], p: P2): Star | null {
  let best: Star | null = null, bd = Infinity
  for (const s of stars) {
    const d = hyp(s.x - p.x, s.y - p.y)
    if (d <= CFG.catchR && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best && s.id < best.id))) { best = s; bd = d }
  }
  return best
}

export const newStar = (id: number, x: number, y: number, rnd: () => number): Star => {
  const a = rnd() * Math.PI * 2
  return { id, x, y, mode: 'wander', dx: Math.cos(a), dy: Math.sin(a), turn: 1 + rnd(), sAcc: 0, nsAcc: 0, hold: 0, calm: 0 }
}

/** 새 별 자리: 친구에게서 minD 이상, 안쪽 경계에서 떨어진 곳(후보 40번 중 가장 먼 곳, 모두 가까우면 그중 가장 나은 곳) */
export function spawnPoint(ps: Who[], stars: P2[], minD: number, rnd: () => number): P2 {
  let best: P2 = { x: 0, y: 0 }, bd = -1
  for (let i = 0; i < 40; i++) {
    const c = { x: (rnd() - 0.5) * (CFG.w - 4), y: (rnd() - 0.5) * (CFG.h - 4) }
    const d = Math.min(...ps.filter((p) => p.on).map((p) => hyp(p.x - c.x, p.y - c.y)), 99, ...stars.map((s) => hyp(s.x - c.x, s.y - c.y) + 2))
    if (d >= minD) return c
    if (d > bd) { bd = d; best = c }
  }
  return best
}

/** 별 한 마리를 dt 초 움직인다(새 객체를 돌려준다) */
export function stepStar(s0: Star, ps: Who[], dt: number, rnd: () => number): Star {
  const s = { ...s0 }
  const on = ps.filter((p) => p.on)
  const dist = on.map((p) => hyp(p.x - s.x, p.y - s.y))
  const nearest = dist.length ? Math.min(...dist) : Infinity
  // 포위 판정: 조건이 0.35초 이어지면 CORNERED(최소 1.2초), 0.5초 풀려야 해제
  if (surrounded(s, ps)) { s.sAcc += dt; s.nsAcc = 0 } else { s.nsAcc += dt; s.sAcc = 0 }
  if (s.mode !== 'cornered' && s.sAcc >= CFG.surroundOn) { s.mode = 'cornered'; s.hold = CFG.surroundMin }
  else if (s.mode === 'cornered') { s.hold = Math.max(0, s.hold - dt); if (s.hold <= 0 && s.nsAcc >= CFG.surroundOff) { s.mode = 'flee'; s.calm = 0 } }
  if (s.mode !== 'cornered') {
    if (nearest < CFG.fleeIn) { s.mode = 'flee'; s.calm = 0 }
    else if (s.mode === 'flee') { s.calm = nearest > CFG.fleeOut ? s.calm + dt : 0; if (s.calm >= CFG.fleeHold) s.mode = 'wander' }
  }
  let vx = 0, vy = 0
  if (s.mode === 'wander') {
    s.turn -= dt
    if (s.turn <= 0) { const a = Math.atan2(s.dy, s.dx) + (rnd() - 0.5) * 2; s.dx = Math.cos(a); s.dy = Math.sin(a); s.turn = 1 + rnd() * 1.5 }
    vx = s.dx; vy = s.dy
  } else {
    for (const p of on) { const d = hyp(s.x - p.x, s.y - p.y); if (d < CFG.fleeIn * 1.4 && d > 1e-6) { const w = 1 / (d * d); vx += ((s.x - p.x) / d) * w; vy += ((s.y - p.y) / d) * w } }
    const l = hyp(vx, vy); if (l > 1e-6) { vx /= l; vy /= l } else { vx = 0; vy = 0 }
  }
  // 경계 회피(안쪽으로 밀기)
  const ex = CFG.w / 2 - Math.abs(s.x), ey = CFG.h / 2 - Math.abs(s.y)
  if (ex < CFG.edge) vx += -Math.sign(s.x) * (1 - ex / CFG.edge) * 2.5
  if (ey < CFG.edge) vy += -Math.sign(s.y) * (1 - ey / CFG.edge) * 2.5
  let l = hyp(vx, vy)
  if (l < 1e-3) { // 합성이 0 → 이전 방향의 접선(멈춤·NaN 방지)
    vx = -s.dy || 1; vy = s.dx || 0; l = hyp(vx, vy)
  }
  vx /= l; vy /= l
  s.dx = vx; s.dy = vy
  const sp = s.mode === 'wander' ? CFG.wander : s.mode === 'flee' ? CFG.flee : CFG.cornered
  s.x = clamp(s.x + vx * sp * dt, -CFG.w / 2 + CFG.starR, CFG.w / 2 - CFG.starR)
  s.y = clamp(s.y + vy * sp * dt, -CFG.h / 2 + CFG.starR, CFG.h / 2 - CFG.starR)
  return s
}

/** 한 판의 공용 상태 */
export interface Round { id: number; target: number; caught: number; stars: Star[]; nextId: number; respawnAt: number[]; res: 0 | 'win' | 'lose'; endAt: number }
export const newRound = (id: number, players: number, endAt: number): Round => ({ id, target: targetFor(players), caught: 0, stars: [], nextId: 1, respawnAt: [], res: 0, endAt })

/** 별을 채운다: 잡은 수 + 활성 별 + 기다리는 별이 목표를 넘지 않게(처음엔 minD=4, 다시 나올 땐 2) */
export function fillStars(r: Round, ps: Who[], now: number, rnd: () => number, first = false): Round {
  if (r.res) return r
  const out = { ...r, stars: [...r.stars], respawnAt: [...r.respawnAt] }
  const ready = out.respawnAt.filter((t) => t <= now).length
  out.respawnAt = out.respawnAt.filter((t) => t > now)
  let want = first ? Math.min(CFG.maxActive, out.target) : ready
  while (want > 0 && out.stars.length < CFG.maxActive && out.caught + out.stars.length + out.respawnAt.length < out.target) {
    const p = spawnPoint(ps, out.stars, first ? CFG.spawnFromPlayer0 : CFG.spawnFromPlayer, rnd)
    out.stars.push(newStar(out.nextId++, p.x, p.y, rnd)); want--
  }
  return out
}

/** 잡기 요청 한 번을 검증한다. 방장만 부른다. 성공하면 새 상태와 잡은 별을 돌려준다 */
export function applyCatch(r: Round, req: { round: number; cdLeft: number }, who: Who, now: number): { round: Round; star: Star | null } {
  if (r.res || req.round !== r.id || !who.on || req.cdLeft > 0 || now > r.endAt) return { round: r, star: null }
  const s = pickCatch(r.stars, who)
  if (!s) return { round: r, star: null }
  const out: Round = { ...r, stars: r.stars.filter((x) => x.id !== s.id), caught: r.caught + 1, respawnAt: [...r.respawnAt] }
  if (out.caught >= out.target) out.res = 'win'
  else out.respawnAt.push(now + CFG.respawn)
  return { round: out, star: s }
}

/** 시간 종료 판정(한 번만) */
export const finishIfTimeUp = (r: Round, now: number): Round => (!r.res && now >= r.endAt ? { ...r, res: r.caught >= r.target ? 'win' : 'lose' } : r)

/** 한 틱: 모든 별 이동 + 재생성 + 시간 종료 */
export function tick(r: Round, ps: Who[], dt: number, now: number, rnd: () => number): Round {
  if (r.res) return r
  const stepped: Round = { ...r, stars: r.stars.map((s) => stepStar(s, ps, dt, rnd)) }
  return finishIfTimeUp(fillStars(stepped, ps, now, rnd), now)
}
