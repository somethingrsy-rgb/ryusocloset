import type { ReactNode, RefObject } from 'react'
import { useI18n } from '../i18n'
import { bgToCss, type Background } from '../lib/backgrounds'
import { BOTTOMS, HEADS, LOWER_IMAGE, TOPS, type Assembly } from '../lib/assemble'
import { assetUrl } from '../lib/items'
import { CANVAS_H, CANVAS_W } from '../lib/layers'

/** 조립 탭에서 보이는 이미지들(아래→위): 몸 아랫부분, 하의, 상의(팔 포함), 머리 */
export function assemblyLayers(a: Assembly): string[] {
  const urls = [LOWER_IMAGE]
  const bottom = BOTTOMS.find((b) => b.id === a.bottom)
  if (bottom) urls.push(assetUrl(bottom.image))
  const top = TOPS.find((t) => t.id === a.top)
  if (top) urls.push(assetUrl(top.image))
  const head = HEADS.find((h) => h.id === a.head)
  if (head) urls.push(assetUrl(head.image))
  return urls
}

interface Props {
  assembly: Assembly
  bg: Background
  figureRef: RefObject<HTMLDivElement | null>
  children?: ReactNode
}

export function AssembleStage({ assembly, bg, figureRef, children }: Props) {
  const { t } = useI18n()
  const layers = assemblyLayers(assembly)
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-3xl shadow-inner ring-1 ring-black/5"
      style={{ background: bgToCss(bg), containerType: 'size' }}
    >
      <div className="absolute inset-0 flex items-end justify-center pb-[3cqh]">
        <div
          ref={figureRef}
          className="sticker relative"
          style={{
            width: `min(calc(92cqh * ${CANVAS_W / CANVAS_H}), 92cqw)`,
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          }}
        >
          {layers.map((src, i) => (
            <img key={src} src={src} alt="" className="layer" style={{ zIndex: i }} draggable={false} />
          ))}
        </div>
      </div>
      {children}
      <div className="pointer-events-none absolute top-2 left-2 z-20 max-w-[calc(100%-4.5rem)]">
        <p className="inline-block rounded-2xl bg-white/85 px-3 py-1.5 text-[11px] leading-tight font-semibold text-cocoa-soft shadow-sm">
          {t('assembleHint')}
        </p>
      </div>
    </div>
  )
}
