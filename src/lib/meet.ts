import { CALL_ANIMALS, kidWords } from './animalCalls'

/**
 * 동물 친구 모으기와 산책길 만남.
 * - 친구 모으기: 수학 단계를 하나 다 풀 때마다(처음 끝낼 때) 친구를 한 명씩 만난다(met). 모은 친구만 파티 초대·농장·주방에 같이 할 수 있다.
 * - 산책길 만남: 길을 걷다 보면 30초 간격으로 동물 친구가 나타나 짧게 이야기만 나눈다(모으기와는 상관없다).
 */
export interface MeetState { met: number[]; last: number }
const KEY = 'ryuso.meet.v1'

/** 이만큼(논리 px, 화면 몇 개 정도) 걸어야 다음 친구가 나타날 수 있다 */
export const MEET_WALK = 3000
/** 산책길에서 지난번에 만난 뒤 이만큼(ms) 지나야 다음 친구가 나타난다 */
export const MEET_GAP = 30_000

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
/** 모은 친구인지 */
export const collected = (animal: number) => state.met.includes(animal)
/** 아직 못 모은 친구들(친구 고르기 창에서 ??? 로 가린다) */
export const notCollected = (s: MeetState = state) => CALL_ANIMALS.map((_, i) => i).filter((i) => !s.met.includes(i))

/** 수학 단계를 하나 처음으로 다 풀었다: 아직 못 모은 친구 한 명을 모은다(모은 친구 번호, 다 모았으면 null) */
export function collectOne(s: MeetState, rnd: () => number = Math.random): { next: MeetState; got: number | null } {
  const left = notCollected(s)
  if (!left.length) return { next: s, got: null }
  const got = left[Math.floor(rnd() * left.length)]
  return { next: { ...s, met: [...s.met, got] }, got }
}
export function collectFriend(): number | null {
  const r = collectOne(state)
  if (r.next !== state) save(r.next)
  return r.got
}

/** 산책길에 지금 친구가 나타나도 되는지: 충분히 걸었고, 지난번 만남에서 30초가 지났는지 */
export const canMeet = (s: MeetState, walked: number, now: number) => walked >= MEET_WALK && now - s.last >= MEET_GAP
/** 산책길에 나타날 친구: 아무나 */
export const pickVisitor = (rnd: () => number = Math.random) => Math.floor(rnd() * CALL_ANIMALS.length)
/** 산책길에서 이야기를 나눴다: 다음 만남까지 시간을 잰다(친구를 모으지는 않는다) */
export const talkedOnRoad = (now = Date.now()) => save({ ...state, last: now })

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
