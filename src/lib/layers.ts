/** 카테고리 정의와 레이어 순서(숫자가 클수록 위). */
export const CATEGORIES = ['top', 'bottom', 'dress', 'costume', 'outer', 'shoes', 'accessory', 'wand', 'bag'] as const
export type Category = (typeof CATEGORIES)[number]

/** 몸(머리 포함) < 신발 < 하의 < 상의 < 원피스 < 아우터 < 앞머리 < 액세서리 < 가방 */
export const LAYER_Z: Record<Category, number> = {
  shoes: 10,
  bottom: 20,
  top: 30,
  dress: 40,
  /** 테마옷: 원피스처럼 한 벌로 입는 화려한 옷 (원피스와 같은 높이) */
  costume: 41,
  outer: 50,
  accessory: 70,
  /** 마법봉: 헤어핀과 따로 고르고 함께 쓸 수 있다 (손에 쥐는 것이라 헤어핀 위) */
  wand: 75,
  bag: 80,
}

/** 앞머리 레이어(옷 위, 액세서리 아래) */
export const HAIR_FRONT_Z = 60
/** 옷 뒤로 가는 머리(몸 바로 위, 신발·옷 아래): 긴 머리가 옷을 가리지 않게 */
export const HAIR_BEHIND_Z = 5
/** 머리 전체가 몸 뒤로 가는 머리: 머리(1)가 몸(2)보다 아래, 둘 다 신발·옷보다 아래 */
export const HAIR_UNDER_BODY_Z = 1
export const BODY_OVER_HAIR_Z = 2

/** 아바타·옷 PNG 공통 캔버스 크기 (옷은 이 캔버스 전체를 (0,0)에 겹쳐 올린다) */
export const CANVAS_W = 1024
export const CANVAS_H = 1536
