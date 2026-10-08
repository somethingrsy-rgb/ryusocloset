/** All prices, rewards and limits are adjusted here or in room-items.json. */
export const ECONOMY = {
  attendance: 5, streakDays: 7, streakBonus: 50, outfit: 10, dailyMission: 30,
  levelBonus: 20, xpPerLevel: 100, outfitXp: 20, attendanceXp: 10, missionXp: 30,
  maxOutfitRewardsPerDay: 3, setDiscount: 0.15, setBonus: 15, maxPresets: 6,
  starter: ['wallpaper_heart', 'floor_wood', 'wall_window_day', 'rug_stripe', 'furniture_sofa_bear'],
} as const
export const THEME_SETS = [
  { id: 'white', name: { ko: '미니멀 화이트', en: 'Minimal white' } },
  { id: 'pink', name: { ko: '핑크 로맨틱', en: 'Pink romantic' } },
  { id: 'wood', name: { ko: '빈티지 우드', en: 'Vintage wood' } },
] as const
