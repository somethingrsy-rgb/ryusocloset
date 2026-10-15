import { assetUrl } from '../lib/items'

/** 농장 배경 위에서 천천히 움직이는 장식: 구름, 나비, 떨어지는 잎·꽃잎 (눌러지지 않고, 동작을 줄이는 설정이면 CSS 에서 멈춘다) */
const CLOUDS = [
  { img: 'fx_cloud_1', top: 2, w: 42, dur: 150, delay: -20, op: 0.95 },
  { img: 'fx_cloud_2', top: 36, w: 36, dur: 190, delay: -110, op: 0.85 },
  { img: 'fx_cloud_3', top: 0, w: 22, dur: 230, delay: -60, op: 0.9 },
]
const BUTTERFLIES = [
  { img: 'fx_butterfly_1', left: 12, top: 44, w: 5.5, dur: 26, delay: -4, path: 'a' },
  { img: 'fx_butterfly_2', left: 55, top: 36, w: 5, dur: 32, delay: -15, path: 'b' },
]
const FALLERS = [
  { img: 'fx_leaf_1', left: 8, w: 3.6, dur: 17, delay: -2 },
  { img: 'fx_petal_1', left: 24, w: 3, dur: 14, delay: -9 },
  { img: 'fx_leaf_2', left: 41, w: 3.4, dur: 19, delay: -13 },
  { img: 'fx_petal_1', left: 58, w: 2.8, dur: 15, delay: -5 },
  { img: 'fx_leaf_1', left: 73, w: 3.2, dur: 18, delay: -11 },
  { img: 'fx_petal_1', left: 88, w: 3, dur: 16, delay: -7 },
]

export function FarmFx() {
  return (
    <div aria-hidden className="farm-fx pointer-events-none absolute inset-0 overflow-hidden">
      {/* 구름은 간판 오른쪽 하늘 부분에서만 지나가고, 왼쪽과 아래는 서서히 사라진다 */}
      <div className="absolute overflow-hidden" style={{ left: '34%', right: 0, top: 0, height: '17%', zIndex: 1, WebkitMaskImage: 'linear-gradient(to right, transparent, #000 18%), linear-gradient(to bottom, #000 60%, transparent)', WebkitMaskComposite: 'source-in', maskImage: 'linear-gradient(to right, transparent, #000 18%), linear-gradient(to bottom, #000 60%, transparent)', maskComposite: 'intersect' }}>
        {CLOUDS.map((c) => (
          <img key={c.img} src={assetUrl(`assets/farm/${c.img}.webp`)} alt="" draggable={false} className="fx-cloud absolute left-0" style={{ top: `${c.top}%`, width: `${c.w}%`, opacity: c.op, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} />
        ))}
      </div>
      {BUTTERFLIES.map((b) => (
        <div key={b.img} className={`fx-fly-${b.path} absolute`} style={{ left: `${b.left}%`, top: `${b.top}%`, width: `${b.w}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, zIndex: 4 }}>
          <img src={assetUrl(`assets/farm/${b.img}.webp`)} alt="" draggable={false} className="fx-flap w-full" />
        </div>
      ))}
      {FALLERS.map((f, i) => (
        <div key={i} className="fx-fall absolute" style={{ left: `${f.left}%`, width: `${f.w}%`, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, zIndex: 4 }}>
          <img src={assetUrl(`assets/farm/${f.img}.webp`)} alt="" draggable={false} className="fx-sway w-full" style={{ animationDuration: `${f.dur / 4}s`, animationDelay: `${f.delay}s` }} />
        </div>
      ))}
    </div>
  )
}
