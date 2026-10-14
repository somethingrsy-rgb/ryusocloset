import type { ReactNode, RefObject } from 'react'
import { useI18n } from '../i18n'
import type { Background } from '../lib/backgrounds'
import { useAvatar } from '../lib/useAvatar'
import { withAvatarFit, withoutAvatarFit } from '../lib/avatarFit'
import { BASE_LAYERS, ITEM_BY_ID, assetUrl } from '../lib/items'
import { HAIR_FRONT_Z, type Category } from '../lib/layers'
import { wornItems } from '../lib/outfit'
import { effectiveZ } from '../lib/tweaks'
import type { Outfit, Tweaks } from '../lib/types'
import { LayerStage, type BaseLayer, type StageLayer } from './LayerStage'

interface Props {
  outfit: Outfit
  tweaks: Tweaks
  bg: Background
  selected: Category | null
  onSelect: (c: Category | null) => void
  onTweaks: (next: Tweaks) => void
  onTakeOff: (c: Category) => void
  canUndo?: boolean
  onUndo?: () => void
  /** 옷을 끌어다 놓을 수 있는 영역(바깥 상자) */
  dropRef: RefObject<HTMLDivElement | null>
  /** 드래그 중인 옷이 무대 위에 있을 때 */
  dropActive: boolean
  figureRef: RefObject<HTMLDivElement | null>
  children?: ReactNode
}

/**
 * 코디 화면의 무대. 레이어(아래→위): 몸(신발 착용 시 맨발 몸) < 신발 < 하의 < 상의 < 원피스 < 아우터 < 앞머리 < 액세서리 < 가방.
 * 입은 옷은 눌러서 선택하고 옮기거나 크기를 바꿀 수 있다.
 */
export function Stage({ outfit, tweaks: userTweaks, onTweaks: setUserTweaks, ...rest }: Props) {
  const avatar = useAvatar() // 아바타를 바꾸면 다시 그린다
  // 이 아바타에서만 필요한 기본 위치를 더해서 그리고, 조절한 값을 저장할 때는 다시 뺀다
  const tweaks = withAvatarFit(outfit, userTweaks, avatar.id)
  const onTweaks = (next: Tweaks) => setUserTweaks(withoutAvatarFit(outfit, next, avatar.id))
  const { lang, t } = useI18n()
  const layers: StageLayer<Category>[] = wornItems(outfit, ITEM_BY_ID, tweaks).map((it) => ({
    key: it.category,
    id: it.id,
    src: assetUrl(it.image),
    z: effectiveZ(it.zIndex, tweaks[it.category]),
    box: it.box,
    label: it.name[lang],
  }))
  const base: BaseLayer[] = [
    { src: outfit.shoes ? BASE_LAYERS.bodyBarefoot : BASE_LAYERS.body, z: 0 },
    { src: BASE_LAYERS.hairFront, z: HAIR_FRONT_Z },
  ]
  return <LayerStage base={base} layers={layers} ariaLabel={t('tweakAria')} {...rest} tweaks={tweaks} onTweaks={onTweaks} />
}
