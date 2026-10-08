import { drawBackground, type Background } from './backgrounds'
import { BASE_LAYERS, ITEM_BY_ID } from './items'
import { CANVAS_H, CANVAS_W, HAIR_FRONT_Z } from './layers'
import { wornItems } from './outfit'
import type { Outfit } from './types'

const imgCache = new Map<string, Promise<HTMLImageElement>>()
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imgCache.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => {
        imgCache.delete(src)
        reject(new Error(`이미지를 불러오지 못했어요: ${src}`))
      }
      img.src = src
    })
    imgCache.set(src, p)
  }
  return p
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** 아바타 + 옷을 화면과 같은 레이어 순서로 1024x1536 캔버스에 합성 */
export async function renderFigure(outfit: Outfit): Promise<HTMLCanvasElement> {
  const items = wornItems(outfit, ITEM_BY_ID)
  const barefoot = !!outfit.shoes
  const [hairBack, body, slippers, hair, ...imgs] = await Promise.all([
    loadImage(BASE_LAYERS.hairBack),
    loadImage(barefoot ? BASE_LAYERS.bodyBarefoot : BASE_LAYERS.body),
    loadImage(BASE_LAYERS.slippers),
    loadImage(BASE_LAYERS.hairFront),
    ...items.map((i) => loadImage(`${import.meta.env.BASE_URL}${i.image}`)),
  ])
  const canvas = makeCanvas(CANVAS_W, CANVAS_H)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(hairBack, 0, 0, CANVAS_W, CANVAS_H)
  ctx.drawImage(body, 0, 0, CANVAS_W, CANVAS_H)
  if (!barefoot) ctx.drawImage(slippers, 0, 0, CANVAS_W, CANVAS_H)
  // 앞머리(60)는 아우터(50) 위, 액세서리(70) 아래
  let hairDrawn = false
  items.forEach((it, idx) => {
    if (!hairDrawn && it.zIndex > HAIR_FRONT_Z) {
      ctx.drawImage(hair, 0, 0, CANVAS_W, CANVAS_H)
      hairDrawn = true
    }
    ctx.drawImage(imgs[idx], 0, 0, CANVAS_W, CANVAS_H)
  })
  if (!hairDrawn) ctx.drawImage(hair, 0, 0, CANVAS_W, CANVAS_H)
  return canvas
}

export interface ExportOptions {
  sticker: boolean
  /** null 이면 투명 배경 */
  background: Background | null
}

const STICKER_R = 12

/** 합성 결과의 윤곽을 따라 흰 스티커 테두리와 은은한 그림자를 만든다 */
function drawSticker(out: CanvasRenderingContext2D, figure: HTMLCanvasElement, ox: number, oy: number) {
  const sil = makeCanvas(figure.width, figure.height)
  const sctx = sil.getContext('2d')!
  sctx.drawImage(figure, 0, 0)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = '#fff'
  sctx.fillRect(0, 0, sil.width, sil.height)

  out.save()
  out.shadowColor = 'rgba(60, 30, 40, 0.28)'
  out.shadowBlur = 14
  out.shadowOffsetY = 5
  for (const r of [STICKER_R, STICKER_R * 0.6]) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      out.drawImage(sil, ox + Math.cos(a) * r, oy + Math.sin(a) * r)
    }
  }
  out.restore()
  // 그림자가 겹겹이 쌓이지 않도록 마지막에 테두리 본체를 그림자 없이 한 번 더
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
    out.drawImage(sil, ox + Math.cos(a) * STICKER_R, oy + Math.sin(a) * STICKER_R)
  }
  out.drawImage(sil, ox, oy)
}

export async function renderOutfitCanvas(outfit: Outfit, opts: ExportOptions): Promise<HTMLCanvasElement> {
  const figure = await renderFigure(outfit)
  const pad = opts.sticker ? STICKER_R + 28 : 0
  const out = makeCanvas(CANVAS_W + pad * 2, CANVAS_H + pad * 2)
  const ctx = out.getContext('2d')!
  if (opts.background) drawBackground(ctx, out.width, out.height, opts.background)
  if (opts.sticker) drawSticker(ctx, figure, pad, pad)
  ctx.drawImage(figure, pad, pad)
  return out
}

export const canvasToBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 변환 실패'))), 'image/png'),
  )

/** "내 코디" 목록용 작은 미리보기(JPEG data URL) */
export async function renderThumb(outfit: Outfit, background: Background): Promise<string> {
  const full = await renderOutfitCanvas(outfit, { sticker: false, background })
  const w = 170
  const h = Math.round((w * full.height) / full.width)
  const small = makeCanvas(w, h)
  const ctx = small.getContext('2d')!
  // 투명 배경 코디도 목록에서 보이도록 밝은 바탕을 깐다
  ctx.fillStyle = '#fff3f6'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(full, 0, 0, w, h)
  return small.toDataURL('image/jpeg', 0.82)
}
