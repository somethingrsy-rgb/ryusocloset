import { CALL_ANIMALS, kidWords } from './animalCalls'

/**
 * 산책길에서 동물 친구 만나기: 길을 걷다 보면 가끔 동물 친구가 나타나 돌아다니고, 다가가면 짧게 이야기를 나눈다.
 * 한 번 만난 친구는 '만난 친구'가 되어 집 파티에 초대할 수 있다(친구를 모으는 느낌). 너무 자주 만나지 않게 간격을 둔다.
 */
export interface MeetState { met: number[]; last: number }
const KEY = 'ryuso.meet.v1'

/** 이만큼(논리 px, 화면 몇 개 정도) 걸어야 다음 친구가 나타날 수 있다 */
export const MEET_WALK = 3000
/** 지난번에 만난 뒤 이만큼(ms) 지나야 다음 친구가 나타난다: 아직 못 만난 친구가 있으면 30초, 다 만났으면 4분 */
export const MEET_GAP = 30_000, MEET_GAP_ALL = 240_000

export function sanitizeMeet(v: unknown): MeetState {
  const r = (v && typeof v === 'object' ? v : {}) as Partial<MeetState>
  const met = Array.isArray(r.met) ? [...new Set(r.met.filter((a): a is number => Number.isInteger(a) && a >= 0 && a < CALL_ANIMALS.length))] : []
  const last = typeof r.last === 'number' && Number.isFinite(r.last) ? r.last : 0
  return { met, last }
}
let state: MeetState = (() => { try { return sanitizeMeet(JSON.parse(localStorage.getItem(KEY) ?? 'null')) } catch { return sanitizeMeet(null) } })()
const listeners = new Set<() => void>()
export const getMeet = () => state
export const subscribeMeet = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
function save(next: MeetState) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* 저장 못 해도 지금은 만난 것으로 */ }
  listeners.forEach((fn) => fn())
}

/** 지금 새 친구가 나타나도 되는지: 충분히 걸었고, 지난번 만남에서 시간이 넉넉히 지났는지 */
export function canMeet(s: MeetState, walked: number, now: number) {
  const gap = s.met.length >= CALL_ANIMALS.length ? MEET_GAP_ALL : MEET_GAP
  return walked >= MEET_WALK && now - s.last >= gap
}
/** 나타날 친구: 아직 못 만난 친구 먼저(모으는 재미), 다 만났으면 아무나 */
export function pickVisitor(s: MeetState, rnd: () => number = Math.random) {
  const all = CALL_ANIMALS.map((_, i) => i)
  const fresh = all.filter((a) => !s.met.includes(a))
  const pool = fresh.length ? fresh : all
  return pool[Math.floor(rnd() * pool.length)]
}
/** 이야기를 나눴다: 만난 친구에 넣고, 다음 만남까지 시간을 잰다 */
export function meetFriend(animal: number, now = Date.now()) {
  save({ met: state.met.includes(animal) ? state.met : [...state.met, animal], last: now })
}

/** 짧은 이야기: 첫인사(처음 만나면 자기소개)와 서로 다른 질문 두 개. 질문마다 아이가 고르는 대답 셋과 친구의 답 */
export interface Ask { ask: string; replies: { label: string; answer: string }[] }
export interface Talk { hello: string; asks: [Ask, Ask] }
const r = (label: string, answer: string) => ({ label, answer })
const ASKS: ((a: (typeof CALL_ANIMALS)[number]) => Ask)[] = [
  () => ({ ask: '오늘 기분은 어때?', replies: [r('좋아!', '다행이다! 나도 기분 최고야!'), r('조금 졸려', '나도 낮잠 자고 싶다~ 히히'), r('신나!', '와, 그럼 같이 신나자!')] }),
  () => ({ ask: '어디 가는 길이야?', replies: [r('산책 가!', '나도 산책 좋아해! 조심히 가~'), r('보물 찾으러', '우와, 보물 찾으면 나도 보여 줘!'), r('비밀이야', '히히, 궁금하다!')] }),
  (a) => ({ ask: `나 아까 ${a.did}! 너는 오늘 뭐 했어?`, replies: [r('그림 그렸어', '멋지다! 나중에 보여 줘!'), r('맛있는 거 먹었어', '우와, 부럽다~ 냠냠!'), r('아직 비밀', '그럼 다음에 꼭 알려 줘!')] }),
  (a) => ({ ask: `나는 ${a.food} 제일 좋아해. 너는 뭐 좋아해?`, replies: [r('딸기!', '딸기 맛있지! 새콤달콤~'), r('케이크!', '케이크라니, 나도 먹고 싶다!'), r('너랑 노는 거', '헤헤, 나도 너랑 노는 게 좋아!')] }),
  () => ({ ask: '오늘 날씨 정말 좋다! 그치?', replies: [r('응, 좋아!', '이런 날은 산책이 최고야!'), r('조금 더워', '그럼 시원한 데서 쉬어 가~'), r('하늘 예뻐', '구름이 솜사탕 같아!')] }),
]
export function talkFor(animal: number, kidName: string | undefined, first: boolean, rnd: () => number = Math.random): Talk {
  const a = CALL_ANIMALS[animal]
  const call = kidWords(kidName).call
  const hello = first ? `${call}, 안녕? 나는 ${a.me}! 만나서 반가워!` : `${call}, 안녕? 또 만났네!`
  const i = Math.floor(rnd() * ASKS.length)
  const j = (i + 1 + Math.floor(rnd() * (ASKS.length - 1))) % ASKS.length // 첫 질문과 다른 것
  return { hello, asks: [ASKS[i](a), ASKS[j](a)] }
}
