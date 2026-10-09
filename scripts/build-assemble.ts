/**
 * 조립 탭용 에셋: assets-src/assemble → public/assets/assemble (webp, 썸네일) + src/data/assemble-items.json
 *
 *   assets-src/assemble/base/head_*.png         머리(목 위), 1024×1536 캔버스에 올려 둔 것. head_ 로 시작하면 머리 선택지가 됨
 *   assets-src/assemble/tops/top_*.png          팔·손이 붙은 상의. 크기 제한 없음 — 아래 TOP_PLACE 로 아바타 캔버스에 놓는다
 *   assets-src/assemble/bottoms/bottom_*.png    다리·발까지 붙은 하의. scripts/assemble-bottoms-fit.json 의 값으로 놓는다 (tools-py/fit_assemble_bottoms.py)
 *   assets-src/assemble/shoes/shoes_*.png       발목이 보이는 신발 한 쌍. scripts/assemble-shoes-fit.json 의 값으로 놓는다 (tools-py/fit_assemble_shoes.py)
 *   scripts/assemble-items.json                 id → 한/영 이름, 색
 *
 * 실행: npm run assets
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { alphaBBox, makeThumb } from './lib/image.ts'
import { CANVAS_H, CANVAS_W } from '../src/lib/layers.ts'
import type { AssemblePart } from '../src/lib/assemble.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'assets-src/assemble')
const OUT = path.join(ROOT, 'public/assets/assemble')

/**
 * 팔 포함 상의 원본(1928×816)을 아바타 캔버스에 놓는 변환: 0.545배로 줄여 (x0, y0) 에 둔다.
 * 아바타의 팔·손 실루엣과 94% 겹치도록 맞춘 값 (이너티 기준, 나머지 상의도 같은 크기로 그려져 있음).
 */
const SHRINK = 0.95 // 상의·하의를 5% 줄인다 (상의는 가로 가운데·어깨선 기준, 하의는 허리 기준으로 줄어든다)
const TOP_SRC_W = 1928
const TOP_CX = -10 + (TOP_SRC_W * 0.545) / 2
const TOP_PLACE: Place = { scale: 0.545 * SHRINK, x0: TOP_CX - (TOP_SRC_W * 0.545 * SHRINK) / 2, y0: 624 }
const WAIST = { x: 512.5, y: 845 } // 아바타 허리 (fit_assemble_bottoms.py 의 WAIST_Y, CX)
const shrinkAtWaist = (p: { s: number; tx: number; ty: number }): Place => ({
  scale: p.s * SHRINK,
  x0: WAIST.x + (p.tx - WAIST.x) * SHRINK,
  y0: WAIST.y + (p.ty - WAIST.y) * SHRINK,
})

const COLORS: Record<string, string> = {
  black: '#2b2b2f', charcoal: '#55565c', gray: '#a3a5ab', white: '#fbfbfb', ivory: '#f6ecd6',
  brown: '#8a5a3b', denim: '#3c5a8c', mint: '#a9dcc8', navy: '#27355b',
}

const bottomFit: Record<string, { s: number; tx: number; ty: number }> = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/assemble-bottoms-fit.json'), 'utf8'),
)

const shoesFit: Record<string, { s: number; tx: number; ty: number }> = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/assemble-shoes-fit.json'), 'utf8'),
)

type Meta = Record<string, { ko?: string; en?: string; color?: string }>
const meta: Meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/assemble-items.json'), 'utf8'))

type Place = { scale: number; x0: number; y0: number }

async function toCanvas(file: string, place?: Place): Promise<Buffer> {
  const m = await sharp(file).metadata()
  if (!place) {
    if (m.width !== CANVAS_W || m.height !== CANVAS_H) {
      throw new Error(`${path.basename(file)}: ${m.width}x${m.height} (${CANVAS_W}x${CANVAS_H} 이어야 합니다)`)
    }
    return sharp(file).png().toBuffer()
  }
  const w = Math.round(m.width! * place.scale)
  const h = Math.round(m.height! * place.scale)
  const resized = await sharp(file).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer()
  const x0 = Math.round(place.x0)
  const y0 = Math.round(place.y0)
  // 캔버스 밖으로 나가는 부분은 잘라낸다
  const srcX = Math.max(0, -x0)
  const srcY = Math.max(0, -y0)
  const dstX = Math.max(0, x0)
  const dstY = Math.max(0, y0)
  const cw = Math.min(w - srcX, CANVAS_W - dstX)
  const ch = Math.min(h - srcY, CANVAS_H - dstY)
  const part = await sharp(resized).extract({ left: srcX, top: srcY, width: cw, height: ch }).toBuffer()
  return sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: part, left: dstX, top: dstY }])
    .png()
    .toBuffer()
}

export async function buildAssemble() {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT, 'thumbs'), { recursive: true })

  const parts: AssemblePart[] = []
  const add = async (stem: string, kind: AssemblePart['kind'], buf: Buffer) => {
    const m = meta[stem] ?? (console.warn(`ℹ assemble-items.json 에 ${stem} 없음 → 파일명 사용`), {})
    await sharp(buf).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${stem}.webp`))
    await makeThumb(buf, path.join(OUT, 'thumbs', `${stem}.webp`), 256, 40)
    const b = await alphaBBox(buf, 40)
    parts.push({
      id: stem,
      kind,
      name: { ko: m.ko ?? stem, en: m.en ?? stem },
      colorHex: m.color ? COLORS[m.color] ?? null : null,
      box: { x: b.left, y: b.top, w: b.width, h: b.height },
      image: `assets/assemble/${stem}.webp`,
      thumb: `assets/assemble/thumbs/${stem}.webp`,
    })
  }

  for (const f of fs.readdirSync(path.join(SRC, 'base')).filter((f) => /^head_.*\.png$/.test(f)).sort()) {
    await add(f.replace(/\.png$/, ''), 'head', await toCanvas(path.join(SRC, 'base', f)))
  }
  for (const f of fs.readdirSync(path.join(SRC, 'tops')).filter((f) => /^top_.*\.png$/.test(f)).sort()) {
    await add(f.replace(/\.png$/, ''), 'top', await toCanvas(path.join(SRC, 'tops', f), TOP_PLACE))
  }
  for (const f of fs.readdirSync(path.join(SRC, 'bottoms')).filter((f) => /^bottom_.*\.png$/.test(f)).sort()) {
    const stem = f.replace(/\.png$/, '')
    const p = bottomFit[stem]
    if (!p) throw new Error(`assemble-bottoms-fit.json 에 ${stem} 없음 — python tools-py/fit_assemble_bottoms.py 를 실행하세요`)
    await add(stem, 'bottom', await toCanvas(path.join(SRC, 'bottoms', f), shrinkAtWaist(p)))
  }
  for (const f of fs.readdirSync(path.join(SRC, 'shoes')).filter((f) => /^shoes_.*\.png$/.test(f)).sort()) {
    const stem = f.replace(/\.png$/, '')
    const p = shoesFit[stem]
    if (!p) throw new Error(`assemble-shoes-fit.json 에 ${stem} 없음 — python tools-py/fit_assemble_shoes.py 를 실행하세요`)
    await add(stem, 'shoes', await toCanvas(path.join(SRC, 'shoes', f), { scale: p.s, x0: p.tx, y0: p.ty }))
  }
  fs.writeFileSync(path.join(ROOT, 'src/data/assemble-items.json'), JSON.stringify(parts, null, 2) + '\n')
  console.log(`✔ 조립 부품 ${parts.length}개`, Object.fromEntries(['head', 'top', 'bottom', 'shoes'].map((k) => [k, parts.filter((p) => p.kind === k).length])))
}
