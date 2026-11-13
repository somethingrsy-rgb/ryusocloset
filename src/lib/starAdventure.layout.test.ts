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
})
