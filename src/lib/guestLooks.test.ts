import { describe, expect, it } from 'vitest'
import { guestLook, sanitizeLooks, setGuestLooks } from './guestLooks'

describe('파티 아바타 친구 옷', () => {
  it('모르는 아바타·옷은 빼고, 원피스와 상의는 같이 입지 않는다', () => {
    expect(sanitizeLooks({ nobody: { top: 'top_anorak_ivory' }, yuha: { top: 'top_anorak_ivory', dress: 'dress_deco_tweed_black', wig: 'wig_blondemess2', shoes: 'no_such_item' } }))
      .toEqual({ yuha: { dress: 'dress_deco_tweed_black', wig: 'wig_blondemess2' } })
    expect(sanitizeLooks('x')).toEqual({})
  })
  it('고른 옷은 아바타마다 기억하고, 안 고른 아바타는 아무것도 안 입는다', () => {
    expect(guestLook('yuel')).toEqual({})
    setGuestLooks({ yuel: { wig: 'wig_blondemess2' } })
    setGuestLooks({ yuha: { top: 'top_anorak_ivory' } })
    expect(guestLook('yuel')).toEqual({ wig: 'wig_blondemess2' })
    expect(guestLook('yuha')).toEqual({ top: 'top_anorak_ivory' })
  })
})
