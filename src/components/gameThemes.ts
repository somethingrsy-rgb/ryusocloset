/** 별 거품·별 모험이 같이 쓰는 컨셉(별 나라 / 할로윈 / 몬스터 마을) 그림과 색 */
/** 단계마다 컨셉이 돌아간다(섞지 않는다): 1단계 별 나라 → 2단계 할로윈 → 3단계 몬스터 마을 → 4단계 다시 별 나라 … */
export interface Theme { id: 'star' | 'halloween' | 'monster'; name: string; sky: string; foes: { walk: string; trapped: string; mad: string; h: number }[]; treats: string[]; plat: [string, string]; wall: [string, string] }
export const MON_POOL = ['bat', 'blob', 'goblin', 'fluff', 'dino', 'dragon', 'jelly', 'golem']
export const THEMES: Theme[] = [
  { id: 'star', name: '별 나라', sky: 'starchase/sky_land.webp', foes: [{ walk: 'starchase/star_idle.webp', trapped: 'starchase/star_scared.webp', mad: 'starchase/star_flee.webp', h: 1.2 }], treats: ['race/fg_cherry.webp', 'race/fg_melonslice.webp', 'race/fg_orangeslice.webp', 'race/fg_pineapple.webp', 'race/fg_blueberry.webp'], plat: ['#ff8fc0', '#8a5ad8'], wall: ['#9b79e0', '#6f4fb8'] },
  { id: 'halloween', name: '할로윈', sky: 'race/sky_halloween.webp', foes: [{ walk: 'starchase/hw_ghost.webp', trapped: 'starchase/hw_ghost.webp', mad: 'starchase/hw_ghost.webp', h: 1.5 }, { walk: 'starchase/hw_pumpkin.webp', trapped: 'starchase/hw_pumpkin.webp', mad: 'starchase/hw_pumpkin.webp', h: 1.2 }], treats: ['race/cd_candy.webp', 'race/cd_cupcake.webp', 'race/cd_lolli_a.webp', 'race/cd_heartcookie.webp', 'race/cd_gummybear.webp'], plat: ['#ff9a3d', '#6a3fa8'], wall: ['#7a4fc0', '#3d2a6b'] },
  { id: 'monster', name: '몬스터 마을', sky: 'starchase/sky_land.webp', foes: [], treats: ['race/fg_strawbush.webp', 'race/fg_blueberry.webp', 'race/fg_cherry.webp', 'race/fg_melonslice.webp', 'race/fg_pineapple.webp'], plat: ['#9be07a', '#3f9a6a'], wall: ['#6fbf8a', '#2f7a5a'] },
]
/** 몬스터 마을의 몬스터 3마리(8종 중, 한 판 동안 같은 친구들) */
export const monsterTheme = (): Theme => {
  const t = THEMES[2]
  const ids = [...MON_POOL].sort(() => Math.random() - 0.5).slice(0, 3)
  return { ...t, foes: ids.map((id) => ({ walk: `travel/monster/${id}_angry.webp`, trapped: `travel/monster/${id}_happy.webp`, mad: `travel/monster/${id}_angry.webp`, h: 1.5 })) }
}
export type FoeImgs = { walk: HTMLImageElement; trapped: HTMLImageElement; mad: HTMLImageElement; h: number }[]

/** 레이스 장소 6곳: 하늘 그림, 땅·관 색, 그 장소에 놓인 구경거리(레이스 길가 그림) */
export interface Place { id: string; ico: string; sky: string; ground: [string, string]; pipe: [string, string]; deco: [string, number][] }
export const PLACES: Place[] = [
  { id: 'meadow', ico: '🌳', sky: 'race/sky_meadow.webp', ground: ['#8ed36a', '#5aa04a'], pipe: ['#7be07a', '#3f9a4a'], deco: [['prop_tree', 4.2], ['prop_bunny', 2.6], ['prop_tree2', 4.2], ['prop_flowers', 1.2]] },
  { id: 'halloween', ico: '🎃', sky: 'race/sky_halloween.webp', ground: ['#7a4fc0', '#3d2a6b'], pipe: ['#ff9a3d', '#c05a1a'], deco: [['hw_tree_green', 4.2], ['hw_pumpkin_house', 3.8], ['hw_castle', 4.6], ['hw_ghost', 3], ['hw_pumpkin_house', 3.8]] },
  { id: 'snow', ico: '❄️', sky: 'race/sky_snow.webp', ground: ['#f2f8ff', '#a9c9e8'], pipe: ['#8ec9f0', '#4a86c0'], deco: [['sn_pine', 4.2], ['sn_snowman', 2.8], ['sn_igloo', 2.8], ['sn_lamp', 3.8], ['sn_castle', 4.6]] },
  { id: 'candy', ico: '🍭', sky: 'race/sky_candy.webp', ground: ['#ffc2dc', '#e88ab4'], pipe: ['#c58bff', '#8a5ad8'], deco: [['cd_lolli_a', 3.8], ['cd_cotton_pink', 4], ['cd_castle', 4.6], ['cd_cakehouse', 3.4], ['cd_lamp_a', 3.8]] },
  { id: 'sea', ico: '🐠', sky: 'race/sky_sea.webp', ground: ['#7fd6e0', '#3a9ab4'], pipe: ['#ff9a8a', '#d8605a'], deco: [['sea_coral_pink', 4], ['sea_shellhouse', 3.6], ['sea_turtlelamp', 3.6], ['sea_coral_purple', 3.6], ['sea_octopus', 2.8]] },
  { id: 'fruit', ico: '🍓', sky: 'race/sky_fruit.webp', ground: ['#ffc96a', '#e8903a'], pipe: ['#8fe06a', '#4aa04a'], deco: [['fr_tree_green', 4.2], ['fr_strawhouse', 3.4], ['fr_tree_lemon', 4.2], ['fr_applehouse', 3.4], ['fr_fruitstand', 2.8]] },
]

/** 바닷속 단계(레이스 장소 5번째)에서는 눈코입이 있는 바다 친구들이 괴물이다 */
export const SEA_LEVEL = 4
export const SEA_FOES: { walk: string; trapped: string; mad: string; h: number }[] = ['sea_turtle', 'sea_jelly', 'sea_clam', 'sea_whale', 'sea_clam2'].map((n) => ({ walk: `starchase/${n}.webp`, trapped: `starchase/${n}.webp`, mad: `starchase/${n}.webp`, h: 1.5 }))

/** 장소 순서(PLACES)마다 어떤 친구가 괴물인지: THEMES 번호(0 별, 1 유령·호박, 2 몬스터), 바닷속은 SEA_FOES. 할로윈 배경에서는 할로윈 괴물이 나온다 */
export const FOE_SET = [0, 1, 2, 0, 0, 2]
