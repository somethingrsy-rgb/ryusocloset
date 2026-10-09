/**
 * assets-src/ 의 원본 PNG → public/assets/ (webp, 썸네일) + src/data/items.json 매니페스트 생성.
 *
 *   assets-src/clothes/<category>_<name>_<color>.png   (1024x1536, 투명 배경, 아바타와 같은 캔버스)
 *   assets-src/base/{body,body_barefoot,hair_front}.png
 *   scripts/labels.json                                 (파일명 → 한/영 이름, 선택적으로 category/color 덮어쓰기)
 *   scripts/fit.json                                    (옷별 자동 맞춤값 sx/sy/dx/dy — tools-py/autofit_clothes.py 가 만듦)
 *
 * 실행: npm run assets
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { alphaBBox, makeThumb } from './lib/image.ts'
import { buildRoom } from './build-room.ts'
import { buildCamp } from './build-camp.ts'
import { CANVAS_H, CANVAS_W, CATEGORIES, LAYER_Z, type Category } from '../src/lib/layers.ts'
import type { Item } from '../src/lib/types.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'assets-src')
const OUT = path.join(ROOT, 'public/assets')

const COLORS: Record<string, { ko: string; en: string; hex: string }> = {
  black: { ko: '블랙', en: 'Black', hex: '#2b2b2f' },
  charcoal: { ko: '차콜', en: 'Charcoal', hex: '#55565c' },
  gray: { ko: '그레이', en: 'Gray', hex: '#a3a5ab' },
  white: { ko: '화이트', en: 'White', hex: '#fbfbfb' },
  ivory: { ko: '아이보리', en: 'Ivory', hex: '#f6ecd6' },
  beige: { ko: '베이지', en: 'Beige', hex: '#dcc5a2' },
  brown: { ko: '브라운', en: 'Brown', hex: '#8a5a3b' },
  khaki: { ko: '카키', en: 'Khaki', hex: '#6f7655' },
  navy: { ko: '네이비', en: 'Navy', hex: '#27355b' },
  denim: { ko: '데님', en: 'Denim', hex: '#3c5a8c' },
  skyblue: { ko: '스카이블루', en: 'Sky Blue', hex: '#8fb8e0' },
  mint: { ko: '민트', en: 'Mint', hex: '#a9dcc8' },
}

/** 코디 탭 옷의 기본 크기: 앱의 '−' 한 번(1/1.08 ≈ 0.93배)만큼 줄여서 만든다. 옷 영역의 중심을 기준으로 줄이는 것도 '−' 와 같다. */
const CLOSET_SHRINK = 1 / 1.08
// 원피스는 한 단계(+) 크게 보이도록 줄이지 않는다 (= 위 값의 1/1.08 을 되돌린 것)
const SHRINK_CATEGORIES: Category[] = ['top', 'bottom', 'outer']

/** anchor 'top': 옷 맨 위(어깨선)를 고정하고 줄인다 (상의가 어깨선에서 내려오지 않게). 'center': 영역 중심 기준 (앱의 − 와 같음) */
async function shrinkAboutCenter(png: string | Buffer, k: number, anchor: 'center' | 'top' = 'center'): Promise<Buffer> {
  const box = await alphaBBox(png)
  const cx = box.left + box.width / 2
  const cy = anchor === 'top' ? box.top : box.top + box.height / 2
  const w = Math.round(CANVAS_W * k)
  const h = Math.round(CANVAS_H * k)
  const small = await sharp(png).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer()
  return sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: small, left: Math.round(cx - cx * k), top: Math.round(cy - cy * k) }])
    .png()
    .toBuffer()
}

type Labels = Record<string, { ko?: string; en?: string; category?: Category; color?: string; native?: boolean }>
const labels: Labels = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/labels.json'), 'utf8'))

const BAG_WORDS = ['bag', 'backpack', 'briefcase', 'handbag', 'tote']

function parseCategory(stem: string): Category {
  const override = labels[stem]?.category
  if (override) return override
  const prefix = stem.split('_')[0]
  if (prefix === 'acc') {
    return BAG_WORDS.some((w) => stem.includes(w)) ? 'bag' : 'accessory'
  }
  if ((CATEGORIES as readonly string[]).includes(prefix)) return prefix as Category
  throw new Error(`카테고리를 알 수 없는 파일명: ${stem} (top_/bottom_/dress_/outer_/shoes_/acc_ 로 시작해야 함)`)
}

function parseColor(stem: string): string | undefined {
  const override = labels[stem]?.color
  if (override) return override
  const last = stem.split('_').pop()!
  return COLORS[last] ? last : undefined
}

function fallbackName(stem: string) {
  const words = stem.split('_').slice(1).filter((w) => !COLORS[w])
  const text = words.join(' ') || stem
  return { ko: text, en: text.replace(/\b\w/g, (c) => c.toUpperCase()) }
}

type Fit = { sx: number; sy: number; dx: number; dy: number }
const fits: Record<string, Fit> = fs.existsSync(path.join(ROOT, 'scripts/fit.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fit.json'), 'utf8'))
  : {}

/**
 * 자동 맞춤값 적용: 옷 영역의 중심을 기준으로 가로·세로 배율을 곱하고 이동한다.
 * (tools-py/autofit_clothes.py 가 계산한 것과 같은 변환) 값이 없으면 원본 파일을 그대로 쓴다.
 */
async function applyFit(file: string, fit?: Fit): Promise<string | Buffer> {
  if (!fit) return file
  const W = CANVAS_W
  const H = CANVAS_H
  const box = await alphaBBox(file, 40)
  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  const w = Math.round(W * fit.sx)
  const h = Math.round(H * fit.sy)
  const left = Math.round(cx - fit.sx * cx + fit.dx)
  const top = Math.round(cy - fit.sy * cy + fit.dy)
  const resized = await sharp(file).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
  // 캔버스 밖으로 나가는 부분은 잘라낸다
  const srcX = Math.max(0, -left)
  const srcY = Math.max(0, -top)
  const dstX = Math.max(0, left)
  const dstY = Math.max(0, top)
  const part = await sharp(resized)
    .extract({ left: srcX, top: srcY, width: Math.min(w - srcX, W - dstX), height: Math.min(h - srcY, H - dstY) })
    .toBuffer()
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: part, left: dstX, top: dstY }])
    .png()
    .toBuffer()
}

async function main() {
  fs.mkdirSync(path.join(OUT, 'base'), { recursive: true })
  fs.mkdirSync(path.join(OUT, 'thumbs'), { recursive: true })
  for (const c of CATEGORIES) fs.rmSync(path.join(OUT, 'clothes', c), { recursive: true, force: true })

  // 1) 아바타 베이스 레이어
  for (const name of ['body', 'body_barefoot', 'hair_front']) {
    const src = path.join(SRC, 'base', `${name}.png`)
    if (!fs.existsSync(src)) throw new Error(`없음: ${src}`)
    const bm = await sharp(src).metadata()
    if (bm.width !== CANVAS_W || bm.height !== CANVAS_H) {
      console.warn(`⚠ base/${name}: ${bm.width}x${bm.height} (기대: ${CANVAS_W}x${CANVAS_H})`)
    }
    await sharp(src).webp({ quality: 95, alphaQuality: 100 }).toFile(path.join(OUT, 'base', `${name}.webp`))
  }

  // 2) 옷
  const files = fs.readdirSync(path.join(SRC, 'clothes')).filter((f) => f.toLowerCase().endsWith('.png')).sort()
  const items: Item[] = []
  for (const file of files) {
    const stem = file.replace(/\.png$/i, '')
    const category = parseCategory(stem)
    const colorKey = parseColor(stem)
    const srcFile = path.join(SRC, 'clothes', file)
    const meta = await sharp(srcFile).metadata()
    if (meta.width !== CANVAS_W || meta.height !== CANVAS_H) {
      console.warn(`⚠ ${file}: ${meta.width}x${meta.height} (${CANVAS_W}x${CANVAS_H} 이어야 아바타와 정렬됩니다)`)
    }
    let src = await applyFit(srcFile, fits[stem])
    if (SHRINK_CATEGORIES.includes(category)) src = await shrinkAboutCenter(src, CLOSET_SHRINK, category === 'top' ? 'top' : 'center')
    fs.mkdirSync(path.join(OUT, 'clothes', category), { recursive: true })
    await sharp(src).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, 'clothes', category, `${stem}.webp`))
    await makeThumb(src, path.join(OUT, 'thumbs', `${stem}.webp`)).catch((e) => {
      throw new Error(`${stem}: ${e.message}`)
    })
    const box = await alphaBBox(src)
    const label = labels[stem] ?? (console.warn(`ℹ labels.json 에 ${stem} 없음 → 파일명으로 이름 생성`), {})
    const fb = fallbackName(stem)
    items.push({
      id: stem,
      category,
      name: { ko: label.ko ?? fb.ko, en: label.en ?? fb.en },
      color: colorKey ?? null,
      colorName: colorKey ? { ko: COLORS[colorKey].ko, en: COLORS[colorKey].en } : null,
      colorHex: colorKey ? COLORS[colorKey].hex : null,
      box: { x: box.left, y: box.top, w: box.width, h: box.height },
      image: `assets/clothes/${category}/${stem}.webp`,
      thumb: `assets/thumbs/${stem}.webp`,
      zIndex: LAYER_Z[category],
      ...(label.native ? { native: true } : {}),
    })
  }
  items.sort(
    (a, b) =>
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.id.localeCompare(b.id),
  )
  fs.writeFileSync(path.join(ROOT, 'src/data/items.json'), JSON.stringify(items, null, 2) + '\n')

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, items.filter((i) => i.category === c).length]))
  console.log(`✔ ${items.length}개 아이템`, counts)
  await buildRoom()
  await buildCamp()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
