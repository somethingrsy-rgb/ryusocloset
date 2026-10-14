import { getAvatar } from './avatars'
import { setTweak, getTweak } from './tweaks'
import type { Outfit, Tweaks } from './types'

/** 앱의 위치 조절 한 칸 = 8px */
const STEP = 8

export interface AvatarItemFit {
  dx?: number
  dy?: number
  /** 크기 배율 (옷 영역 중심 기준) */
  scale?: number
}

/**
 * 아바타마다 몸 비율이 조금씩 달라서, 특정 아바타에서만 어긋나는 옷은 여기에 기본 위치를 적어 둔다.
 * 옷 파일은 그대로 두고 화면에 그릴 때만 더해지므로 다른 아바타에는 영향이 없다.
 * 사용자가 직접 조절한 값(tweaks)은 이 위에 더해진다.
 */
export const AVATAR_FIT: Record<string, Record<string, AvatarItemFit>> = {
  ryuso: {
    costume_hanbok_pink_flower: { dy: -1 * STEP },
    costume_snow_fur: { dy: -2 * STEP },
    costume_trump_blue: { dy: -1 * STEP },
    costume_yellow_qipao: { dy: -1 * STEP },
    dress_cape_red: { dy: -1 * STEP },
    dress_card_red: { dy: -1 * STEP },
    dress_lolita_black: { dy: -1 * STEP },
    dress_lolita_purple: { dy: -1 * STEP },
    dress_maid_blue: { dy: -1 * STEP },
  },
}

const fitOf = (avatarId: string, itemId: string | undefined) => (itemId ? AVATAR_FIT[avatarId]?.[itemId] : undefined)

/** 입은 옷에 지금 아바타의 기본 위치를 더한 조절값 (화면·저장 그림에 그릴 때 쓴다) */
export function withAvatarFit(outfit: Outfit, tweaks: Tweaks, avatarId: string = getAvatar().id): Tweaks {
  if (!AVATAR_FIT[avatarId]) return tweaks
  let out = tweaks
  for (const [cat, id] of Object.entries(outfit)) {
    const f = fitOf(avatarId, id)
    if (!f) continue
    const t = getTweak(tweaks, cat as keyof Tweaks & string)
    out = setTweak(out, cat as never, { ...t, dx: t.dx + (f.dx ?? 0), dy: t.dy + (f.dy ?? 0), scale: t.scale * (f.scale ?? 1) })
  }
  return out
}

/** withAvatarFit 의 반대: 화면에서 조절한 값에서 기본 위치를 빼서 사용자가 조절한 값만 남긴다 */
export function withoutAvatarFit(outfit: Outfit, merged: Tweaks, avatarId: string = getAvatar().id): Tweaks {
  if (!AVATAR_FIT[avatarId]) return merged
  let out = merged
  for (const [cat, id] of Object.entries(outfit)) {
    const f = fitOf(avatarId, id)
    if (!f) continue
    const t = getTweak(merged, cat as never)
    out = setTweak(out, cat as never, { ...t, dx: t.dx - (f.dx ?? 0), dy: t.dy - (f.dy ?? 0), scale: t.scale / (f.scale ?? 1) })
  }
  return out
}
