import { ECONOMY } from '../data/economy.ts'
export interface CatalogItem { id: string; price: number; setId?: string | null; unlock?: { type: 'level' | 'streak' | 'points' | 'event'; value: number | string } | null }
export interface EconomyState {
  version: 1; points: number; earned: number; xp: number; owned: string[];
  lastAttendance: string | null; streak: number; bestStreak: number;
  rewards: Record<string, string[]>; missions: string[]; completedSets: string[];
}
export function initialEconomy(legacy: string[] = []): EconomyState {
  return { version: 1, points: 0, earned: 0, xp: 0, owned: [...new Set([...ECONOMY.starter, ...legacy])], lastAttendance: null, streak: 0, bestStreak: 0, rewards: {}, missions: [], completedSets: [] }
}
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const dayOrdinal = (key: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw Error('INVALID_DATE'); const n = Date.parse(`${key}T00:00:00Z`); if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,10)!==key) throw Error('INVALID_DATE'); return n/86400000 }
export const levelOf = (s: EconomyState) => Math.floor(s.xp / ECONOMY.xpPerLevel) + 1
function credit(s: EconomyState, amount: number, xp = 0): EconomyState {
  const n = { ...s, xp: s.xp + xp }; const bonus = (levelOf(n)-levelOf(s))*ECONOMY.levelBonus
  return { ...n, points: s.points+amount+bonus, earned: s.earned+amount+bonus }
}
export function attend(s: EconomyState, day = dayKey()): EconomyState {
  const ordinal=dayOrdinal(day)
  if (s.lastAttendance && ordinal<=dayOrdinal(s.lastAttendance)) return s
  const streak=s.lastAttendance && ordinal-dayOrdinal(s.lastAttendance)===1 ? s.streak+1 : 1
  return credit({ ...s, lastAttendance: day, streak, bestStreak: Math.max(s.bestStreak,streak) }, ECONOMY.attendance + (streak%ECONOMY.streakDays===0 ? ECONOMY.streakBonus : 0), ECONOMY.attendanceXp)
}
export function rewardOutfit(s: EconomyState, fingerprint: string, day = dayKey()): EconomyState {
  dayOrdinal(day); if (!fingerprint || fingerprint.length>4000) return s
  const keys=s.rewards[day]??[]; if (keys.includes(fingerprint) || keys.length>=ECONOMY.maxOutfitRewardsPerDay) return s
  return credit({...s,rewards:{...s.rewards,[day]:[...keys,fingerprint]}},ECONOMY.outfit,ECONOMY.outfitXp)
}
export function mission(s: EconomyState, day = dayKey()): EconomyState {
  if (s.missions.includes(day) || !(s.rewards[day]?.length)) return s
  return credit({...s,missions:[...s.missions,day]},ECONOMY.dailyMission,ECONOMY.missionXp)
}
export function unlocked(s: EconomyState, item: CatalogItem): boolean {
  if (!item.unlock) return true
  const u=item.unlock
  if(u.type==='level') return levelOf(s)>=Number(u.value)
  if(u.type==='streak') return s.bestStreak>=Number(u.value)
  if(u.type==='points') return s.earned>=Number(u.value)
  return false // Events require a future explicit local event grant.
}
export function setQuote(s: EconomyState, catalog: CatalogItem[], setId: string) {
  const missing=catalog.filter(i=>i.setId===setId && !s.owned.includes(i.id))
  return { missing, price: Math.ceil(missing.reduce((sum,i)=>sum+i.price,0)*(1-ECONOMY.setDiscount)) }
}
function awardSets(s: EconomyState, catalog: CatalogItem[]): EconomyState {
  let n=s
  for(const id of new Set(catalog.map(i=>i.setId).filter((v): v is string=>!!v))) {
    if(!n.completedSets.includes(id) && catalog.filter(i=>i.setId===id).every(i=>n.owned.includes(i.id))) n=credit({...n,completedSets:[...n.completedSets,id]},ECONOMY.setBonus)
  }
  return n
}
export function buy(s: EconomyState, catalog: CatalogItem[], id: string): EconomyState {
  const item=catalog.find(i=>i.id===id); if(!item) throw Error('UNKNOWN_ITEM')
  if(s.owned.includes(id)) return s
  if(!unlocked(s,item)) throw Error('LOCKED')
  if(s.points<item.price) throw Error('INSUFFICIENT_POINTS')
  return awardSets({...s,points:s.points-item.price,owned:[...s.owned,id]},catalog)
}
export function buySet(s: EconomyState, catalog: CatalogItem[], id: string): EconomyState {
  if(!catalog.some(i=>i.setId===id)) throw Error('UNKNOWN_SET')
  const q=setQuote(s,catalog,id); if(!q.missing.length) return s
  if(q.missing.some(i=>!unlocked(s,i))) throw Error('LOCKED')
  if(s.points<q.price) throw Error('INSUFFICIENT_POINTS')
  return awardSets({...s,points:s.points-q.price,owned:[...s.owned,...q.missing.map(i=>i.id)]},catalog)
}
export function validateEconomy(raw: unknown, catalog: CatalogItem[]): EconomyState {
  if(!raw || typeof raw!=='object') throw Error('INVALID_BACKUP')
  const s=raw as EconomyState
  if(s.version!==1) throw Error('BACKUP_VERSION')
  for(const key of ['points','earned','xp','streak','bestStreak'] as const) if(!Number.isSafeInteger(s[key]) || s[key]<0 || s[key]>100000000) throw Error('INVALID_BACKUP')
  if(s.earned<s.points || s.bestStreak<s.streak) throw Error('INVALID_BACKUP')
  const arr=(a: unknown,max: number): a is string[]=>Array.isArray(a) && a.length<=max && a.every(v=>typeof v==='string' && v.length<4001) && new Set(a).size===a.length
  if(!arr(s.owned,catalog.length) || s.owned.some(id=>!catalog.some(i=>i.id===id)) || ECONOMY.starter.some(id=>!s.owned.includes(id))) throw Error('INVALID_BACKUP')
  if(!arr(s.missions,20000) || !arr(s.completedSets,100) || !s.rewards || Array.isArray(s.rewards) || typeof s.rewards!=='object' || Object.keys(s.rewards).length>20000) throw Error('INVALID_BACKUP')
  if(s.lastAttendance!==null) dayOrdinal(s.lastAttendance)
  for(const d of s.missions) dayOrdinal(d)
  const rewards: Record<string,string[]>={}
  for(const [d,v] of Object.entries(s.rewards)){dayOrdinal(d);if(!arr(v,ECONOMY.maxOutfitRewardsPerDay))throw Error('INVALID_BACKUP');rewards[d]=[...v]}
  return {version:1,points:s.points,earned:s.earned,xp:s.xp,owned:[...s.owned],lastAttendance:s.lastAttendance,streak:s.streak,bestStreak:s.bestStreak,rewards,missions:[...s.missions],completedSets:[...s.completedSets]}
}
