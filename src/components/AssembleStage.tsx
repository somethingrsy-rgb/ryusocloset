import type { ReactNode, RefObject } from 'react'
import { useI18n } from '../i18n'
import type { Background } from '../lib/backgrounds'
import { PART_BY_ID, SLOTS, SLOT_Z, type Assembly, type AssembleTweaks, type Slot } from '../lib/assemble'
import { assetUrl } from '../lib/items'
import { LayerStage, type StageLayer } from './LayerStage'

/** 조립 탭에서 보이는 겹들(아래→위): 하의(다리·발 포함) < 상의(팔·손 포함) < 머리. 몸통과 속옷은 없다. */
export function assemblyLayers(a: Assembly, lang: 'ko' | 'en' = 'ko'): StageLayer<Slot>[] {
  const out: StageLayer<Slot>[] = []
  for (const slot of SLOTS) {
    const part = a[slot] ? PART_BY_ID[a[slot]!] : undefined
    if (!part) continue
    out.push({ key: slot, id: part.id, src: assetUrl(part.image), z: SLOT_Z[slot], box: part.box, label: part.name[lang] })
  }
  return out
}

interface Props {
  assembly: Assembly
  bg: Background
  selected: Slot | null
  onSelect: (s: Slot | null) => void
  onTweaks: (next: AssembleTweaks) => void
  onTakeOff: (s: Slot) => void
  dropRef: RefObject<HTMLDivElement | null>
  dropActive: boolean
  figureRef: RefObject<HTMLDivElement | null>
  children?: ReactNode
}

export function AssembleStage({ assembly, ...rest }: Props) {
  const { lang, t } = useI18n()
  return (
    <LayerStage
      base={[]}
      layers={assemblyLayers(assembly, lang)}
      tweaks={assembly.tweaks ?? {}}
      hint={t('assembleHint')}
      ariaLabel={t('tweakAria')}
      {...rest}
    />
  )
}
