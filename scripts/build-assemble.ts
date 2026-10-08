/**
 * 조립 탭용 에셋: assets-src/assemble → public/assets/assemble (webp, 썸네일) + src/data/assemble-items.json
 *
 *   assets-src/assemble/base/lower.png          몸 아랫부분(허리~다리), 1024×1536 — tools-py/make_assemble_base.py 가 만듦
 *   assets-src/assemble/base/head_*.png         머리(목 위), 1024×1536 캔버스에 올려 둔 것. head_ 로 시작하면 머리 선택지가 됨
 *   assets-src/assemble/tops/top_*.png          팔·손이 붙은 상의. 크기 제한 없음 — 아래 TOP_PLACE 로 아바타 캔버스에 놓는다
 *   scripts/assemble-items.json                 id → 한/영 이름, 색
 *
 * 하의는 코디 탭의 하의 중 현재 아바타 기준으로 새로 그린 것(`native`)을 그대로 쓴다.
 * 실행: npm run assets
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { makeThumb } from './lib/image.ts'
import { CANVAS_H, CANVAS_W } from '../src/lib/layers.ts'
import type { AssemblePart } from '../src/lib/assemble.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'assets-src/assemble')
const OUT = path.join(ROOT, 'public/assets/assemble')

/**
 * 팔 포함 상의 원본(1928×816)을 아바타 캔버스에 놓는 변환: 0.545배로 줄여 (x0, y0) 에 둔다.
 * 아바타의 팔·손 실루엣과 94% 겹치도록 맞춘 값 (이너티 기준, 나머지 상의도 같은 크기로 그려져 있음).
 */
const TOP_PLACE = { scale: 0.545, x0: -10, y0: 624 }

const COLORS: Record<string, string> = {
  black: '#2b2b2f', gray: '#a3a5ab', ivory: '#f6ecd6', mint: '#a9dcc8',
}

type Meta = Record<string, { ko?: string; en?: string; color?: string }>
const meta: Meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/assemble-items.json'), 'utf8'))

async function toCanvas(file: string, place?: typeof TOP_PLACE): Promise<Buffer> {
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
  // 캔버스 밖으로 나가는 부분은 잘라낸다
  const srcX = Math.max(0, -place.x0)
  const dstX = Math.max(0, place.x0)
  const cw = Math.min(w - srcX, CANVAS_W - dstX)
  const ch = Math.min(h, CANVAS_H - place.y0)
  const part = await sharp(resized).extract({ left: srcX, top: 0, width: cw, height: ch }).toBuffer()
  return sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: part, left: dstX, top: place.y0 }])
    .png()
    .toBuffer()
}

export async function buildAssemble() {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT, 'thumbs'), { recursive: true })

  const lower = await toCanvas(path.join(SRC, 'base/lower.png'))
  await sharp(lower).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(OUT, 'lower.webp'))

  const parts: AssemblePart[] = []
  const add = async (stem: string, kind: 'head' | 'top', buf: Buffer) => {
    const m = meta[stem] ?? (console.warn(`ℹ assemble-items.json 에 ${stem} 없음 → 파일명 사용`), {})
    await sharp(buf).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${stem}.webp`))
    await makeThumb(buf, path.join(OUT, 'thumbs', `${stem}.webp`), 256, 40)
    parts.push({
      id: stem,
      kind,
      name: { ko: m.ko ?? stem, en: m.en ?? stem },
      colorHex: m.color ? COLORS[m.color] ?? null : null,
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
  fs.writeFileSync(path.join(ROOT, 'src/data/assemble-items.json'), JSON.stringify(parts, null, 2) + '\n')
  console.log(`✔ 조립 부품 ${parts.length}개`, { head: parts.filter((p) => p.kind === 'head').length, top: parts.filter((p) => p.kind === 'top').length })
}
