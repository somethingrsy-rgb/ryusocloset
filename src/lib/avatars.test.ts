import { beforeEach, describe, expect, it } from 'vitest'
import { AVATARS, baseFiles, getAvatar, setAvatar } from './avatars'

describe('avatars', () => {
  beforeEach(() => setAvatar(AVATARS[0].id))
  it('기본은 첫 아바타이고 모르는 id 는 무시한다', () => {
    setAvatar('nobody')
    expect(getAvatar().id).toBe(AVATARS[0].id)
  })
  it('바꾸면 그 아바타의 레이어 경로를 쓰고 저장한다', () => {
    setAvatar('yuha')
    expect(getAvatar().id).toBe('yuha')
    expect(baseFiles(getAvatar()).body).toBe('assets/base/yuha/body.webp')
    expect(localStorage.getItem('ryuso.avatar.v1')).toBe('yuha')
  })
})
