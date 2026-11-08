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
/** 바른 생활 습관 이야기: 친구와 사이좋게·양보하기·선생님과 어른 말씀 잘 듣기·인사·정리·손 씻기·이 닦기·골고루 먹기·일찍 자기.
 *  대답을 무엇을 골라도 친구가 다정하게 칭찬하거나 알려 준다 */
const ASKS: ((a: (typeof CALL_ANIMALS)[number]) => Ask)[] = [
  () => ({ ask: '친구가 내 장난감을 같이 하고 싶대. 어떻게 할까?', replies: [r('같이 놀자고 해', '우와, 멋지다! 같이 놀면 두 배로 재밌어!'), r('차례대로 하자고 해', '좋은 생각이야! 차례를 지키면 모두 즐거워!'), r('나 혼자 할래', '음~ 친구도 하고 싶을 거야. 조금씩 나눠 쓰면 더 사이좋아져!')] }),
  () => ({ ask: '그네 타려고 줄을 섰는데, 동생이 먼저 타고 싶대!', replies: [r('먼저 타라고 양보해', '양보하는 마음 정말 예쁘다! 동생이 고마워할 거야!'), r('같이 기다리자고 해', '맞아, 줄을 서서 기다리는 게 약속이야!'), r('내가 먼저 탈래', '줄을 선 건 잘했어! 그래도 가끔 양보하면 마음이 따뜻해져~')] }),
  () => ({ ask: '선생님이 이야기하실 때는 어떻게 해야 할까?', replies: [r('눈 보고 잘 들어', '최고야! 잘 들으면 새로운 걸 많이 배울 수 있어!'), r('손 들고 말해', '맞아! 손 들고 차례를 기다리면 멋진 어린이야!'), r('친구랑 떠들어', '앗, 그럼 선생님 말씀을 놓칠 수 있어. 다 듣고 나서 이야기하자!')] }),
  () => ({ ask: '엄마 아빠가 "이제 정리하자~" 하시면?', replies: [r('바로 정리해', '우와, 말씀을 잘 듣는구나! 방이 반짝반짝해지겠다!'), r('조금만 더 놀고', '조금 더 놀고 싶은 마음 알아! 그래도 약속한 시간엔 같이 치우자~'), r('같이 하자고 해', '같이 하면 금방 끝나! 어른들도 기뻐하실 거야!')] }),
  () => ({ ask: '친구랑 다퉜어. 어떻게 하면 좋을까?', replies: [r('먼저 미안해라고 해', '먼저 사과하는 건 정말 용기 있는 거야! 대단해!'), r('왜 속상했는지 말해', '좋아! 마음을 말로 하면 서로 더 잘 알 수 있어!'), r('그냥 모른 척해', '음~ 그러면 마음이 계속 속상할 거야. "우리 화해하자!" 해 볼까?')] }),
  () => ({ ask: '밖에서 놀고 들어오면 제일 먼저 뭘 할까?', replies: [r('손 깨끗이 씻기', '딩동댕! 비누로 뽀득뽀득 씻으면 세균이 도망가!'), r('간식 먹기', '간식 먹기 전에 손부터 씻자! 그래야 배가 안 아파~'), r('인사하기', '"다녀왔습니다!" 인사 멋지다! 그다음엔 손 씻기!')] }),
  () => ({ ask: '자기 전에 꼭 해야 하는 건 뭘까?', replies: [r('이 닦기', '맞아! 치카치카 하면 이가 튼튼해져!'), r('일찍 자기', '일찍 자면 키도 쑥쑥, 내일도 쌩쌩해!'), r('게임 더 하기', '헤헤, 재밌지만 잠이 부족하면 내일 힘들어. 오늘은 푹 자자!')] }),
  () => ({ ask: '밥 먹을 때 싫어하는 채소가 나오면?', replies: [r('한 입 먹어 볼래', '용감하다! 골고루 먹으면 몸이 튼튼해져!'), r('골고루 다 먹어', '최고야! 그럼 나처럼 힘이 세질 거야!'), r('안 먹을래', '처음엔 어려울 수 있어. 딱 한 입만 도전해 볼까?')] }),
  () => ({ ask: '어른을 만나면 어떻게 인사할까?', replies: [r('안녕하세요! 해', '바르게 인사하는 모습 정말 멋져!'), r('고개 숙여 인사해', '공손하게 인사하면 모두 기분이 좋아져!'), r('손만 흔들어', '반가운 마음은 좋아! 어른께는 "안녕하세요!"도 같이 해 볼까?')] }),
]
export function talkFor(animal: number, kidName: string | undefined, first: boolean, rnd: () => number = Math.random): Talk {
  const a = CALL_ANIMALS[animal]
  const call = kidWords(kidName).call
  const hello = first ? `${call}, 안녕? 나는 ${a.me}! 만나서 반가워!` : `${call}, 안녕? 또 만났네!`
  const i = Math.floor(rnd() * ASKS.length)
  const j = (i + 1 + Math.floor(rnd() * (ASKS.length - 1))) % ASKS.length // 첫 질문과 다른 것
  return { hello, asks: [ASKS[i](a), ASKS[j](a)] }
}
