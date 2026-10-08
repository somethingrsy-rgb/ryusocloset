/** 배경 정의: 화면(CSS)과 PNG 내보내기(canvas) 양쪽에서 같은 모양으로 그린다. */
export type Background =
  | { id: string; kind: 'transparent' }
  | { id: string; kind: 'solid'; color: string }
  | { id: string; kind: 'gradient'; from: string; to: string }
  | { id: string; kind: 'dots'; base: string; dot: string }
  | { id: string; kind: 'stripes'; a: string; b: string }

export const BACKGROUNDS: Background[] = [
  { id: 'cream', kind: 'solid', color: '#fff3e6' },
  { id: 'pink', kind: 'solid', color: '#ffdbe6' },
  { id: 'mint', kind: 'solid', color: '#d3f1e4' },
  { id: 'sky', kind: 'solid', color: '#d7e8ff' },
  { id: 'lilac', kind: 'solid', color: '#e6dcff' },
  { id: 'lemon', kind: 'solid', color: '#fff3bf' },
  { id: 'sunset', kind: 'gradient', from: '#ffd9e0', to: '#ffe9c2' },
  { id: 'ocean', kind: 'gradient', from: '#d2ecff', to: '#d9f5e8' },
  { id: 'dream', kind: 'gradient', from: '#e7dcff', to: '#ffdbe9' },
  { id: 'dots-pink', kind: 'dots', base: '#ffe9ef', dot: '#ffc2d4' },
  { id: 'dots-mint', kind: 'dots', base: '#e4f6ee', dot: '#b7e3cf' },
  { id: 'stripes', kind: 'stripes', a: '#fff7f0', b: '#ffe6d6' },
  { id: 'transparent', kind: 'transparent' },
]

export const DEFAULT_BG_ID = 'pink'
export const bgById = (id: string): Background => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[1]

const CHECKER =
  'conic-gradient(#e9e9ee 25%, #fff 0 50%, #e9e9ee 0 75%, #fff 0) 0 0 / 20px 20px'

/** CSS `background` 단축 속성 값 */
export function bgToCss(bg: Background): string {
  switch (bg.kind) {
    case 'transparent':
      return CHECKER
    case 'solid':
      return bg.color
    case 'gradient':
      return `linear-gradient(160deg, ${bg.from}, ${bg.to})`
    case 'dots':
      return `radial-gradient(${bg.dot} 22%, transparent 24%) 0 0 / 28px 28px, ${bg.base}`
    case 'stripes':
      return `repeating-linear-gradient(90deg, ${bg.a} 0 22px, ${bg.b} 22px 44px)`
  }
}

/** canvas 에 배경을 채운다 (transparent 는 아무것도 하지 않음) */
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: Background) {
  switch (bg.kind) {
    case 'transparent':
      return
    case 'solid':
      ctx.fillStyle = bg.color
      ctx.fillRect(0, 0, w, h)
      return
    case 'gradient': {
      const g = ctx.createLinearGradient(w * 0.3, 0, w * 0.7, h)
      g.addColorStop(0, bg.from)
      g.addColorStop(1, bg.to)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      return
    }
    case 'dots': {
      ctx.fillStyle = bg.base
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = bg.dot
      const step = 40
      for (let y = step / 2; y < h + step; y += step) {
        for (let x = step / 2; x < w + step; x += step) {
          ctx.beginPath()
          ctx.arc(x, y, step * 0.22, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      return
    }
    case 'stripes': {
      const stripe = 32
      for (let x = 0, i = 0; x < w; x += stripe, i++) {
        ctx.fillStyle = i % 2 === 0 ? bg.a : bg.b
        ctx.fillRect(x, 0, stripe, h)
      }
      return
    }
  }
}
