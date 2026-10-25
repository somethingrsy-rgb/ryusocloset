import { CROPS, type CropId } from './farm'

/**
 * 주방 레시피: 카페 메뉴마다 필요한 재료와 만드는 단계.
 * 재료는 농장에서 수확한 것(당근·딸기·옥수수)과 주방 냉장고에서 코인으로 사는 기본 재료로 나뉜다.
 */
export const PANTRY = [
  { id: 'milk', ko: '우유', en: 'Milk', emoji: '🥛' },
  { id: 'ice', ko: '얼음', en: 'Ice', emoji: '🧊' },
  { id: 'sugar', ko: '설탕', en: 'Sugar', emoji: '🍬' },
  { id: 'flour', ko: '밀가루', en: 'Flour', emoji: '🌾' },
  { id: 'egg', ko: '달걀', en: 'Egg', emoji: '🥚' },
  { id: 'chocolate', ko: '초콜릿', en: 'Chocolate', emoji: '🍫' },
  { id: 'coffee', ko: '커피콩', en: 'Coffee beans', emoji: '☕' },
  { id: 'soda', ko: '탄산수', en: 'Sparkling water', emoji: '🫧' },
] as const
export type PantryId = (typeof PANTRY)[number]['id']
export type IngId = CropId | PantryId
/** 기본 재료는 3개 묶음을 2코인에 산다 */
export const PACK = 3
export const PACK_PRICE = 2

export const isCrop = (id: IngId): id is CropId => CROPS.some((c) => c.id === id)
export function ingredient(id: IngId) {
  const c = CROPS.find((x) => x.id === id)
  if (c) return { id, ko: c.ko, en: c.en[0].toUpperCase() + c.en.slice(1), emoji: c.emoji, farm: true }
  const p = PANTRY.find((x) => x.id === id)!
  return { id, ko: p.ko, en: p.en, emoji: p.emoji, farm: false }
}

/** 요리 단계: 어느 자리(그림 속 싱크대·도마·냄비·오븐·냉장고)를 몇 번 톡톡 누르는지 */
export type Station = 'fridge' | 'sink' | 'board' | 'stove' | 'oven'
export const STEPS = {
  wash: { station: 'sink', taps: 3, emoji: '💧', ko: '씻기', en: 'Wash', how: { ko: '싱크대를 톡톡 눌러 씻어요', en: 'Tap the sink to wash' } },
  cut: { station: 'board', taps: 4, emoji: '🔪', ko: '썰기', en: 'Cut', how: { ko: '도마를 톡톡 눌러 썰어요', en: 'Tap the board to cut' } },
  grind: { station: 'board', taps: 4, emoji: '⚙️', ko: '갈기', en: 'Grind', how: { ko: '도마를 톡톡 눌러 커피콩을 갈아요', en: 'Tap the board to grind' } },
  mix: { station: 'board', taps: 5, emoji: '🥣', ko: '섞기', en: 'Mix', how: { ko: '도마를 톡톡 눌러 반죽을 섞어요', en: 'Tap the board to mix' } },
  blend: { station: 'board', taps: 5, emoji: '🌀', ko: '믹서 돌리기', en: 'Blend', how: { ko: '도마를 톡톡 눌러 믹서를 돌려요', en: 'Tap the board to blend' } },
  pour: { station: 'board', taps: 2, emoji: '🥤', ko: '붓기', en: 'Pour', how: { ko: '도마를 눌러 컵에 부어요', en: 'Tap the board to pour' } },
  bake: { station: 'oven', taps: 3, emoji: '🔥', ko: '굽기', en: 'Bake', how: { ko: '오븐을 톡톡 눌러 구워요', en: 'Tap the oven to bake' } },
  boil: { station: 'stove', taps: 3, emoji: '♨️', ko: '끓이기', en: 'Boil', how: { ko: '냄비를 톡톡 눌러 끓여요', en: 'Tap the pot to boil' } },
  melt: { station: 'stove', taps: 3, emoji: '🍫', ko: '녹이기', en: 'Melt', how: { ko: '냄비를 톡톡 눌러 초콜릿을 녹여요', en: 'Tap the pot to melt' } },
  top: { station: 'board', taps: 3, emoji: '🍓', ko: '올리기', en: 'Decorate', how: { ko: '도마를 톡톡 눌러 딸기를 올려요', en: 'Tap the board to decorate' } },
  roll: { station: 'board', taps: 3, emoji: '🌀', ko: '말기', en: 'Roll', how: { ko: '도마를 톡톡 눌러 돌돌 말아요', en: 'Tap the board to roll' } },
  dip: { station: 'board', taps: 3, emoji: '🍫', ko: '찍기', en: 'Dip', how: { ko: '도마를 톡톡 눌러 딸기를 초콜릿에 찍어요', en: 'Tap the board to dip' } },
  chill: { station: 'fridge', taps: 2, emoji: '❄️', ko: '굳히기', en: 'Chill', how: { ko: '냉장고를 눌러 차갑게 굳혀요', en: 'Tap the fridge to chill' } },
} as const satisfies Record<string, { station: Station; taps: number; emoji: string; ko: string; en: string; how: { ko: string; en: string } }>
export type StepId = keyof typeof STEPS

export interface Menu { id: string; ko: string; en: string; emoji: string; need: Partial<Record<IngId, number>>; steps: StepId[]; price: number }

/** 메뉴 값 = 농장 재료를 그냥 팔 때 값 + 기본 재료 수 + 3코인(만드는 수고). 그래서 요리해서 팔면 늘 조금 더 번다 */
const priced = (m: Omit<Menu, 'price'>): Menu => ({
  ...m,
  price: Object.entries(m.need).reduce((s, [id, n]) => s + (n ?? 0) * (CROPS.find((c) => c.id === id)?.price ?? 1), 0) + 3,
})

/** 메뉴 그림은 public/cafe/menu2/<id>.webp (없으면 이모지) */
export const MENU: Menu[] = ([
  { id: 'latte', ko: '카페라테', en: 'Cafe latte', emoji: '☕', need: { coffee: 1, milk: 1 }, steps: ['grind', 'pour'] },
  { id: 'coffee', ko: '아이스 커피', en: 'Iced coffee', emoji: '🧋', need: { coffee: 1, ice: 1 }, steps: ['grind', 'pour'] },
  { id: 'shake', ko: '딸기 우유 쉐이크', en: 'Strawberry shake', emoji: '🥤', need: { strawberry: 2, milk: 1, ice: 1 }, steps: ['wash', 'blend'] },
  { id: 'ade', ko: '딸기 에이드', en: 'Strawberry ade', emoji: '🍹', need: { strawberry: 2, soda: 1, ice: 1 }, steps: ['wash', 'cut', 'pour'] },
  { id: 'macaron', ko: '마카롱', en: 'Macaron', emoji: '🍬', need: { flour: 1, egg: 1, sugar: 1, strawberry: 1 }, steps: ['mix', 'bake'] },
  { id: 'cupcake', ko: '딸기 컵케이크', en: 'Strawberry cupcake', emoji: '🧁', need: { flour: 1, egg: 1, milk: 1, strawberry: 1 }, steps: ['mix', 'bake', 'top'] },
  { id: 'slice', ko: '딸기 케이크', en: 'Strawberry cake', emoji: '🍰', need: { flour: 1, egg: 1, milk: 1, strawberry: 3 }, steps: ['mix', 'bake', 'top'] },
  { id: 'roll', ko: '딸기 롤케이크', en: 'Strawberry roll cake', emoji: '🍥', need: { flour: 1, egg: 1, sugar: 1, strawberry: 2 }, steps: ['mix', 'bake', 'roll'] },
  { id: 'choco', ko: '초코 딸기', en: 'Choco strawberries', emoji: '🍓', need: { strawberry: 3, chocolate: 1 }, steps: ['wash', 'melt', 'dip'] },
  { id: 'jelly', ko: '딸기 젤리 케이크', en: 'Jelly cake', emoji: '🍮', need: { strawberry: 3, sugar: 1, milk: 1 }, steps: ['boil', 'chill'] },
  { id: 'carrot_juice', ko: '당근 주스', en: 'Carrot juice', emoji: '🥕', need: { carrot: 2, ice: 1 }, steps: ['wash', 'blend'] },
  { id: 'carrot_cake', ko: '당근 케이크', en: 'Carrot cake', emoji: '🎂', need: { carrot: 2, flour: 1, egg: 1 }, steps: ['wash', 'cut', 'mix', 'bake'] },
  { id: 'corn_soup', ko: '옥수수 수프', en: 'Corn soup', emoji: '🍲', need: { corn: 2, milk: 1 }, steps: ['cut', 'boil'] },
  { id: 'corn_cheese', ko: '콘치즈', en: 'Corn cheese', emoji: '🌽', need: { corn: 2, milk: 1 }, steps: ['mix', 'bake'] },
] satisfies Omit<Menu, 'price'>[]).map(priced)

export const menuById = (id: string) => MENU.find((m) => m.id === id)
export const needList = (m: Menu) => Object.entries(m.need).map(([id, n]) => ({ id: id as IngId, n: n ?? 0 }))
