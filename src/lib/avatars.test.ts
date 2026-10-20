import { beforeEach, describe, expect, it } from 'vitest'
import { AVATARS, baseFiles, bodyZ, getAvatar, getHairstyle, hairZ, setAvatar, setHairstyle } from './avatars'
import { BODY_OVER_HAIR_Z, HAIR_BEHIND_Z, HAIR_FRONT_Z, LAYER_Z } from './layers'

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
  it('유하의 기본 머리는 양갈래', () => {
    const yuha = AVATARS.find((a) => a.id === 'yuha')!
    expect(yuha.hairstyles[0].id).toBe('twin')
    expect(baseFiles(yuha, yuha.hairstyles[0]).hairFront).toBe('assets/base/yuha/hair_twin.webp')
  })
  it('류소의 긴 머리 넷은 몸 뒤(몸·옷보다 아래)에 그리고, 단발은 앞머리 높이', () => {
    const ryuso = AVATARS.find((a) => a.id === 'ryuso')!
    expect(hairZ(ryuso)).toBe(HAIR_FRONT_Z); expect(bodyZ(ryuso)).toBe(0)
    for (const id of ['wig', 'tails', 'braidwave', 'longwave']) {
      setHairstyle(ryuso, id)
      expect(hairZ(ryuso)).toBe(HAIR_BEHIND_Z); expect(bodyZ(ryuso)).toBe(BODY_OVER_HAIR_Z)
      expect(HAIR_BEHIND_Z).toBeLessThan(BODY_OVER_HAIR_Z)
      expect(BODY_OVER_HAIR_Z).toBeLessThan(Math.min(...Object.values(LAYER_Z)))
      expect(baseFiles(ryuso).body).toMatch(/^assets\/base\/body_(wig|tails|braid|wave)\.webp$/)
    }
    setHairstyle(ryuso, 'bob')
  })
})
