/** 마법에 걸린 몬스터들과 대왕 몬스터 도감(산책·농장·카페 3D 가 같이 쓴다) */
/** 마법에 걸린 몬스터(무서운 얼굴 → 마법이 풀리면 귀여운 얼굴). 그림 크기(가로·세로), stage = 몇 단계부터 나오는지 */
export const MONSTERS: { id: string; name: string; size: readonly [number, number]; stage: number }[] = [
  { id: 'dino', name: '아기 공룡', size: [909, 1205], stage: 0 },
  { id: 'blob', name: '별더듬이', size: [1059, 1181], stage: 0 },
  { id: 'fluff', name: '복슬이', size: [1140, 1201], stage: 0 },
  { id: 'bat', name: '보라 박쥐', size: [1214, 1192], stage: 0 },
  { id: 'goblin', name: '초록 뿔이', size: [996, 1072], stage: 0 },
  { id: 'bunny', name: '분홍 토끼', size: [250, 301], stage: 1 },
  { id: 'penguin', name: '왕관 펭귄', size: [262, 309], stage: 1 },
  { id: 'lion', name: '해님 사자', size: [267, 307], stage: 1 },
  { id: 'sheep', name: '구름 양', size: [269, 295], stage: 1 },
  { id: 'sprout', name: '새싹 몽이', size: [249, 301], stage: 1 },
  { id: 'puppy', name: '점박이 강아지', size: [345, 307], stage: 2 },
  { id: 'owl', name: '무지개 부엉이', size: [283, 309], stage: 2 },
  { id: 'hedgehog', name: '도토리 고슴도치', size: [293, 305], stage: 2 },
  { id: 'jelly', name: '별 해파리', size: [264, 307], stage: 2 },
  { id: 'mushroom', name: '딸기 버섯', size: [286, 309], stage: 2 },
  { id: 'fox', name: '바람 여우', size: [287, 314], stage: 3 },
  { id: 'polar', name: '눈꽃 곰', size: [289, 312], stage: 3 },
  { id: 'dragon', name: '꼬마 용', size: [309, 319], stage: 3 },
  { id: 'lotus', name: '연꽃 요정', size: [260, 318], stage: 3 },
  { id: 'golem', name: '수정 골렘', size: [296, 319], stage: 3 },
  { id: 'angel', name: '구름 천사', size: [323, 314], stage: 4 },
  { id: 'peach', name: '복숭아 콩이', size: [234, 310], stage: 4 },
  { id: 'otter', name: '튜브 수달', size: [271, 298], stage: 4 },
  { id: 'unicorn', name: '무지개 유니콘', size: [262, 314], stage: 4 },
  { id: 'pudding', name: '푸딩 몬', size: [288, 308], stage: 4 },
]
/** 단계: 몬스터를 이만큼 구하면 다음 다섯 마리가 나오기 시작한다 */
export const STAGE_AT = [0, 10, 25, 45, 70]
export const stageOf = (rescued: number) => STAGE_AT.filter((n) => rescued >= n).length - 1
export const nextStageIn = (rescued: number) => { const n = STAGE_AT.find((x) => x > rescued); return n === undefined ? null : n - rescued }
/** 같이 사냥으로 마법을 풀어 준 대왕 몬스터 도감(이 기기에 저장) */
export const DEX_KEY = 'ryuso.walk.bossDex'
export const loadDex = (): string[] => { try { const v = JSON.parse(localStorage.getItem(DEX_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && MONSTERS.some((m) => m.id === x)) : [] } catch { return [] } }
/** 도감에 넣는다. 처음 들어왔으면 true */
export function addDex(id: string): boolean {
  const cur = loadDex()
  if (cur.includes(id)) return false
  try { localStorage.setItem(DEX_KEY, JSON.stringify([...cur, id])) } catch { /* 이번만 */ }
  dexListeners.forEach((f) => f())
  return true
}
const dexListeners = new Set<() => void>()
export const subscribeDex = (f: () => void) => { dexListeners.add(f); return () => { dexListeners.delete(f) } }
