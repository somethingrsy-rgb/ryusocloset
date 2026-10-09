import { describe, expect, it } from 'vitest'
import { backupName, parseBackup } from './backup'

const good = {
  app: 'ryuso-closet-backup',
  version: 1,
  createdAt: 123,
  local: { 'ryuso.room.v1': '{"a":1}', 'other.key': 'x', 'ryuso.bad': 5 },
  custom: { items: [{ id: 'custom_x' }], roomItems: [] },
}

describe('백업 파일 검사', () => {
  it('이 앱의 백업이면 ryuso. 키의 문자열 값만 받아들인다', () => {
    const b = parseBackup(JSON.stringify(good))!
    expect(Object.keys(b.local)).toEqual(['ryuso.room.v1'])
    expect(b.custom.items).toHaveLength(1)
  })
  it('다른 파일·깨진 파일·더 새 버전은 거절한다', () => {
    expect(parseBackup('not json')).toBeNull()
    expect(parseBackup('{}')).toBeNull()
    expect(parseBackup(JSON.stringify({ ...good, app: 'other' }))).toBeNull()
    expect(parseBackup(JSON.stringify({ ...good, version: 99 }))).toBeNull()
    expect(parseBackup(JSON.stringify({ ...good, custom: {} }))).toBeNull()
  })
  it('파일 이름에 날짜와 시간이 들어간다', () => {
    expect(backupName(new Date(2026, 9, 9, 7, 5))).toBe('ryuso-closet-20261009-0705.json')
  })
})
