import { describe, expect, it } from 'vitest'
import { UNKNOWN_T, planCustom, planKv } from './core'

describe('planKv: 나중에 고친 쪽이 이긴다', () => {
  it('클라우드가 더 새것이면 받아 오고, 이 기기가 더 새것이면 올린다', () => {
    const p = planKv({ a: 'L', b: 'L' }, { a: 100, b: 300 }, { a: { v: 'R', t: 200 }, b: { v: 'R', t: 200 } })
    expect(p.pull.map((x) => x.key)).toEqual(['a'])
    expect(p.push.map((x) => x.key)).toEqual(['b'])
  })
  it('같은 시각이면 아무 일도 하지 않는다', () => {
    const p = planKv({ a: 'x' }, { a: 5 }, { a: { v: 'x', t: 5 } })
    expect(p).toEqual({ pull: [], push: [] })
  })
  it('한쪽에만 있는 키는 없는 쪽으로 간다', () => {
    const p = planKv({ onlyLocal: 'x' }, {}, { onlyRemote: { v: 'y', t: 9 } })
    expect(p.push.map((x) => x.key)).toEqual(['onlyLocal'])
    expect(p.pull.map((x) => x.key)).toEqual(['onlyRemote'])
  })
  it('시각을 모르는 이 기기 데이터는 클라우드의 실제 수정이 이긴다', () => {
    const p = planKv({ a: 'default' }, {}, { a: { v: 'real', t: 1_700_000_000_000 } })
    expect(p.pull).toHaveLength(1)
    expect(p.push).toEqual([])
    expect(UNKNOWN_T).toBeLessThan(1_700_000_000_000)
  })
})

describe('planCustom: 합집합 + 삭제 표시', () => {
  it('없는 것은 서로 채우고 삭제 표시가 있으면 이 기기에서도 지운다', () => {
    const p = planCustom(['a', 'b'], [], [
      { id: 'b', del: false },
      { id: 'c', del: false },
      { id: 'a', del: true },
    ])
    expect(p.add).toEqual(['c'])
    expect(p.remove).toEqual(['a'])
    expect(p.push).toEqual([])
  })
  it('이 기기에만 있으면 올린다', () => {
    expect(planCustom(['a', 'b'], [], [{ id: 'a', del: false }]).push).toEqual(['b'])
  })
  it('이 기기에서 지운 것은 다시 받아 오지 않고 삭제 표시를 남긴다', () => {
    const p = planCustom([], ['x'], [{ id: 'x', del: false }])
    expect(p.add).toEqual([])
    expect(p.tombstone).toEqual(['x'])
  })
  it('이미 삭제 표시된 것을 이 기기에 없을 때는 아무것도 안 한다', () => {
    const p = planCustom([], [], [{ id: 'x', del: true }])
    expect(p).toEqual({ add: [], remove: [], push: [], tombstone: [] })
  })
})
