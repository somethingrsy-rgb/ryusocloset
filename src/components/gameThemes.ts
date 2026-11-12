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
