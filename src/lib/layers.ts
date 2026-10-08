/** 카테고리 정의와 레이어 순서(숫자가 클수록 위). */
export const CATEGORIES = ['top', 'bottom', 'dress', 'outer', 'shoes', 'accessory', 'bag'] as const
export type Category = (typeof CATEGORIES)[number]

/** 몸(머리 포함) < 신발 < 하의 < 상의 < 원피스 < 아우터 < 앞머리 < 액세서리 < 가방 */
export const LAYER_Z: Record<Category, number> = {
  shoes: 10,
  bottom: 20,
  top: 30,
  dress: 40,
  outer: 50,
  accessory: 70,
  bag: 80,
}

/** 앞머리 레이어(옷 위, 액세서리 아래) */
export const HAIR_FRONT_Z = 60


/** 아바타·옷 PNG 공통 캔버스 크기 (옷은 이 캔버스 전체를 (0,0)에 겹쳐 올린다) */
export const CANVAS_W = 1024
export const CANVAS_H = 1536

/**
 * 예전 아바타(851×1280 캔버스)용으로 만든 옷을 새 캔버스로 옮기는 변환.
 * 얼굴 특징점으로 구한 값(옛 아바타와 새 몸 이미지가 99.5% 일치): 새 위치 = 옛 위치 × scale + (dx, dy).
 * 크기가 1024×1536 인 옷 PNG 는 이 변환 없이 그대로 쓴다.
 */
export const LEGACY_CANVAS = { w: 851, h: 1280, scale: 1.1745, dx: -58, dy: 33 }
