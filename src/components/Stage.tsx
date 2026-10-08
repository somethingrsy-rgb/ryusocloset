import type { ReactNode, RefObject } from 'react'
import { bgToCss, type Background } from '../lib/backgrounds'
import { CANVAS_H, CANVAS_W } from '../lib/layers'
import type { Outfit } from '../lib/types'
import { FigureLayers } from './FigureLayers'

interface Props {
  outfit: Outfit
  bg: Background
  figureRef: RefObject<HTMLDivElement | null>
  children?: ReactNode
}

/** 코디 화면의 무대: 배경 위에 스티커 테두리가 있는 아바타를 보여준다. */
export function Stage({ outfit, bg, figureRef, children }: Props) {
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
          <FigureLayers outfit={outfit} />
        </div>
      </div>
      {children}
    </div>
  )
}
