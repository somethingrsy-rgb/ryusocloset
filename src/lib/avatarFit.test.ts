import { describe, expect, it } from 'vitest'
import { withAvatarFit, withoutAvatarFit } from './avatarFit'
import type { Outfit, Tweaks } from './types'

const outfit: Outfit = { costume: 'costume_snow_fur', top: 'top_ivory' }

describe('avatarFit', () => {
  it('류소에서만 지정한 옷에 기본 위치(위로 2칸 = -16px)를 더한다', () => {
    expect(withAvatarFit(outfit, {}, 'ryuso').costume).toEqual({ dx: 0, dy: -16, scale: 1 })
    expect(withAvatarFit(outfit, {}, 'ryuso').top).toBeUndefined()
  })
  it('다른 아바타는 그대로 둔다', () => {
    const t: Tweaks = { costume: { dx: 3, dy: 4, scale: 1.1 } }
    expect(withAvatarFit(outfit, t, 'yuha')).toBe(t)
    expect(withAvatarFit(outfit, {}, 'soyoung')).toEqual({})
  })
  it('사용자가 조절한 값 위에 더하고, 빼면 원래 값으로 돌아온다', () => {
    const user: Tweaks = { costume: { dx: 2, dy: 5, scale: 1.2 } }
    const merged = withAvatarFit(outfit, user, 'ryuso')
    expect(merged.costume).toEqual({ dx: 2, dy: -11, scale: 1.2 })
    expect(withoutAvatarFit(outfit, merged, 'ryuso')).toEqual(user)
  })
  it('조절이 없던 옷은 빼면 조절값이 남지 않는다', () => {
    expect(withoutAvatarFit(outfit, withAvatarFit(outfit, {}, 'ryuso'), 'ryuso')).toEqual({})
  })
})
