import { assetUrl } from './items'

/**
 * 3D 화면(카페·농장·산책·달리기·주방)의 동물 친구 그림: 앞모습·뒷모습(public/animals3d).
 * 동물 친구 여덟(곰이·몽실·냥이·멍멍·삐약·꽥꽥·다람·판다)은 원래 이름 그대로 그림만 바뀌고,
 * 새 친구 다섯(호랑이·너구리·유니콘·하마·사자)은 3D 산책에서 거닌다.
 */
const SIZE: Record<string, [number, number]> = {
  bear: [221, 280], bunny: [191, 300], cat: [213, 274], dog: [272, 275], chick: [201, 274], duck: [203, 275], squirrel: [253, 291], panda: [218, 290],
  tiger: [253, 299], raccoon: [258, 284], unicorn: [248, 289], hippo: [198, 278], lion: [280, 306],
}
const BACK: Record<string, [number, number]> = {
  bear: [219, 279], bunny: [176, 298], cat: [208, 274], dog: [270, 275], chick: [197, 266], duck: [197, 275], squirrel: [217, 290], panda: [217, 289],
  tiger: [254, 298], raccoon: [250, 283], unicorn: [200, 289], hippo: [200, 277], lion: [267, 306],
}
export const animal3dUrl = (img: string, back = false) => assetUrl(`animals3d/${img}${back ? '_back' : ''}.webp`)
/** 가로 ÷ 세로 */
export const animal3dAspect = (img: string, back = false) => { const s = (back ? BACK : SIZE)[img] ?? [1, 1]; return s[0] / s[1] }
/** 3D 산책의 새 친구들 */
export const EXTRA_ANIMALS = [
  { img: 'tiger', name: '어흥이', hi: '어흥~ 안녕! 같이 산책하자 🐯' },
  { img: 'raccoon', name: '너구리', hi: '킁킁, 맛있는 냄새가 나! 🦝' },
  { img: 'unicorn', name: '유니', hi: '반짝반짝~ 오늘도 예뻐! 🦄' },
  { img: 'hippo', name: '하마', hi: '하암~ 낮잠 자고 일어났어 🦛' },
  { img: 'lion', name: '사자', hi: '내 갈기 멋지지? 🦁' },
] as const
/** (dx, dz) 쪽으로 걸어갈 때 카메라에서 멀어지는 쪽이면 true(뒷모습을 보여 준다) */
export const walkingAway = (dx: number, dz: number, px: number, pz: number, cx: number, cz: number) => {
  const vx = px - cx, vz = pz - cz, l = Math.hypot(dx, dz) * Math.hypot(vx, vz)
  return l > 0 && (dx * vx + dz * vz) / l > 0.45
}
