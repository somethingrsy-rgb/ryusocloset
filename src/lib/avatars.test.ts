import { beforeEach, describe, expect, it } from 'vitest'
import { AVATARS, baseFiles, getAvatar, getHairstyle, setAvatar, setHairstyle } from './avatars'

describe('avatars', () => {
  beforeEach(() => setAvatar(AVATARS[0].id))
  it('기본은 첫 아바타이고 모르는 id 는 무시한다', () => {
    setAvatar('nobody')
    expect(getAvatar().id).toBe(AVATARS[0].id)
  })
  it('바꾸면 그 아바타의 레이어 경로를 쓴다', () => {
    setAvatar('yuha')
    expect(getAvatar().id).toBe('yuha')
    expect(baseFiles(getAvatar()).body).toBe('assets/base/yuha/body.webp')
  })
  it('머리를 바꾸면 그 머리 레이어를 쓰고, 모르는 머리는 무시한다', () => {
    const yuha = AVATARS.find((a) => a.id === 'yuha')!
    setHairstyle(yuha, 'twin')
    expect(getHairstyle(yuha).id).toBe('twin')
    expect(baseFiles(yuha).hairFront).toBe('assets/base/yuha/hair_twin.webp')
    setHairstyle(yuha, 'nothing')
    expect(getHairstyle(yuha).id).toBe('twin')
    setHairstyle(yuha, 'braid')
    expect(getHairstyle(yuha).id).toBe('braid')
  })
})
