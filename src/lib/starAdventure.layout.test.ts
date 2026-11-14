import { describe, expect, it } from 'vitest'
import { CFG, LEVELS, newRun, solid } from './starAdventure'

/** 사람이 넘을 수 없는 곳이 없는지: 관 위·옆의 머리 위 공간, 관 높이, 구덩이 폭 */
describe('별 모험 판 모양(넘을 수 없는 곳이 없다)', () => {
  const apex = (CFG.jump * CFG.jump) / (2 * CFG.g) // 한 번 뛰어 올라가는 최대 높이(칸)
  for (let l = 0; l < LEVELS; l++) {
    const s = newRun(l), R = s.main
    const at = (c: number, r: number) => (r < 0 || r >= R.rows.length ? '.' : R.rows[r][c])
    it(`${l + 1}단계: 관 위에 올라설 수 있고 머리 위가 막히지 않는다`, () => {
      for (let r = 0; r < R.rows.length; r++) for (let c = 0; c < R.w; c++) if ('le'.includes(at(c, r))) {
        const top = r // 관 윗면(위 칸 바닥)
        const height = 10 - top
        expect(height, `관 c=${c} 높이 ${height}칸은 점프(${apex.toFixed(1)}칸)로 넘기 어려워요`).toBeLessThanOrEqual(2)
        // 커진 모습(키 1.7칸)도 서 있고 넘을 수 있게 관 윗면 위 2칸이 비어 있어야 한다(오른쪽 한 칸 포함: 관 위에서 걸어 내려올 때 머리가 닿지 않게)
        for (let cc = c; cc <= c + 2; cc++) for (let rr = top - 2; rr <= top - 1; rr++) expect(solid(at(cc, rr)), `관 c=${c} 위 (${cc},${rr})가 막혀 있어요`).toBe(false)
      }
    })
    it(`${l + 1}단계: 구덩이 폭이 너무 넓지 않다`, () => {
      let run = 0, max = 0
      for (let c = 0; c < R.w; c++) { if (!solid(at(c, 10))) { run++; max = Math.max(max, run) } else run = 0 }
      expect(max).toBeLessThanOrEqual(4)
    })
  }
  it('20단계까지 있고 단계마다 판 모양이 다르다', () => {
    expect(LEVELS).toBe(20)
    const shapes = new Set(Array.from({ length: LEVELS }, (_, l) => newRun(l).main.rows.map((r) => r.join('')).join('/')))
    expect(shapes.size).toBeGreaterThanOrEqual(LEVELS - 3) // 1~6단계는 손으로 만든 3가지를 쓰므로 6단계 안에서만 겹칠 수 있다
  })
  for (let l = 0; l < LEVELS; l++) {
    it(`${l + 1}단계: 보너스방 관이 있고, 괴물이 구덩이·관 위가 아닌 곳에 서 있고, 장애물 사이에 걸을 땅이 있다`, () => {
      const R = newRun(l).main, at = (c: number, r: number) => (c < 0 || c >= R.w || r < 0 || r >= 12 ? '.' : R.rows[r][c])
      expect(R.rows.some((row) => row.includes('e'))).toBe(true)
      for (const f of R.foes) { const c = Math.floor(f.x), r = Math.round(f.y); expect(solid(at(c, r)) || r >= 10 ? solid(at(c, r)) || at(c, 10) !== '.' : false, `괴물 (${c},${f.y}) 밑이 비어 있어요`).toBe(true); expect(solid(at(c, r - 1)), `괴물이 벽 속에 있어요 (${c},${f.y})`).toBe(false) }
      // 땅(10줄)이 이어진 길이: 구덩이와 구덩이 사이·관 사이가 너무 짧지 않다(처음 계단 구역 제외)
      let run = 0, min = 99, seen = false // 처음과 끝의 시작·깃발 쪽 땅은 빼고, 장애물과 장애물 사이만 잰다
      for (let c = 9; c < R.w - 5; c++) { if (solid(at(c, 10)) && !'lrLRef'.includes(at(c, 9))) run++; else { if (run > 0 && seen) min = Math.min(min, run); if (run > 0 || !seen) seen = true; run = 0 } }
      if (l >= 6) expect(min, `땅 길이 ${min}`).toBeGreaterThanOrEqual(3) // 1~6단계는 손으로 만든 모양(계단·관이 붙어 있음)이라 제외
    })
  }
})
