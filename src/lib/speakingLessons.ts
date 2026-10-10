export interface SpeakingTurn {
  question: string
  meaning: string
  answer: string
  answerMeaning: string
  alternatives?: string[]
  cue: string
}
export interface SpeakingLesson {
  id: string
  title: { ko: string; en: string }
  icon: string
  words: { en: string; ko: string }[]
  turns: SpeakingTurn[]
}
export const SPEAKING_LESSONS: SpeakingLesson[] = [
  { id: 'cafe', title: { ko: '카페에서 주문하기', en: 'At the café' }, icon: '☕',
    words: [{ en: 'coffee', ko: '커피' }, { en: 'tea', ko: '차' }, { en: 'hot', ko: '따뜻한' }, { en: 'iced', ko: '아이스' }],
    turns: [
      { question: 'Coffee or tea?', meaning: '커피 드릴까요, 차 드릴까요?', answer: 'Coffee, please.', answerMeaning: '커피 주세요.', alternatives: ['A coffee, please.', "I'd like a coffee, please."], cue: '☕ 커피를 주문해요' },
      { question: 'Coffee or tea?', meaning: '커피 드릴까요, 차 드릴까요?', answer: 'Tea, please.', answerMeaning: '차 주세요.', alternatives: ['A tea, please.', "I'd like some tea, please."], cue: '🍵 이번에는 차를 주문해요' },
      { question: 'Hot or iced?', meaning: '따뜻하게 드릴까요, 아이스로 드릴까요?', answer: 'Hot, please.', answerMeaning: '따뜻하게 주세요.', alternatives: ["I'd like it hot, please."], cue: '♨️ 따뜻한 음료를 골라요' },
    ] },
  { id: 'shop', title: { ko: '가게에서 물건 고르기', en: 'At the shop' }, icon: '🛍️',
    words: [{ en: 'blue', ko: '파란색' }, { en: 'pink', ko: '분홍색' }, { en: 'bag', ko: '가방' }, { en: 'thanks', ko: '고마워요' }],
    turns: [
      { question: 'Blue or pink?', meaning: '파란색과 분홍색 중 어떤 걸 드릴까요?', answer: 'Blue, please.', answerMeaning: '파란색 주세요.', alternatives: ["I'd like the blue one, please."], cue: '💙 파란색을 골라요' },
      { question: 'Blue or pink?', meaning: '파란색과 분홍색 중 어떤 걸 드릴까요?', answer: 'Pink, please.', answerMeaning: '분홍색 주세요.', alternatives: ["I'd like the pink one, please."], cue: '🩷 이번에는 분홍색을 골라요' },
      { question: 'Do you need a bag?', meaning: '가방이 필요하세요?', answer: 'No, thank you.', answerMeaning: '아니요, 괜찮아요.', alternatives: ['No, thanks.'], cue: '🙅 가방은 필요 없어요' },
    ] },
  { id: 'weekend', title: { ko: '주민과 주말 이야기', en: 'Weekend chat' }, icon: '🏡',
    words: [{ en: 'park', ko: '공원' }, { en: 'home', ko: '집' }, { en: 'tired', ko: '피곤한' }, { en: 'rest', ko: '쉬다' }],
    turns: [
      { question: 'Where did you go?', meaning: '어디에 갔어요?', answer: 'I went to the park.', answerMeaning: '공원에 갔어요.', alternatives: ['To the park.'], cue: '🌳 공원에 갔어요' },
      { question: 'Where did you go?', meaning: '어디에 갔어요?', answer: 'I went home.', answerMeaning: '집에 갔어요.', alternatives: ['Home.'], cue: '🏠 이번에는 집에 갔다고 말해요' },
      { question: 'How did you feel?', meaning: '기분이나 몸 상태가 어땠어요?', answer: 'I was tired.', answerMeaning: '피곤했어요.', alternatives: ['Tired.'], cue: '😴 피곤했어요' },
    ] },
]
export function normalizeSpeech(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim()
}
/** Match supported replies, not pronunciation quality. */
export function matchesReply(text: string, turn: SpeakingTurn): boolean {
  const withoutPlease = (value: string) => normalizeSpeech(value).replace(/\s+please$/, '')
  const input = withoutPlease(text)
  return !!input && [turn.answer, ...(turn.alternatives ?? [])].some(reply => withoutPlease(reply) === input)
}

export interface ReplyCheck {
  /** match: 인정되는 대답 / almost: 단어가 꽤 맞음 / retry: 많이 다름 */
  level: 'match' | 'almost' | 'retry'
  /** 가장 가까운 정답의 단어와 들렸는지 여부 */
  words: { word: string; heard: boolean }[]
}

/** 말한 내용을 정답과 단어 단위로 비교한다 (발음 점수가 아니라 인식된 단어 기준). */
export function checkReply(text: string, turn: SpeakingTurn): ReplyCheck {
  const heard = new Set(normalizeSpeech(text).split(' ').filter(Boolean))
  const strip = (v: string) => normalizeSpeech(v).replace(/\s+please$/, '').split(' ').filter(Boolean)
  let best: ReplyCheck['words'] = strip(turn.answer).map(word => ({ word, heard: false }))
  let bestRatio = -1
  for (const reply of [turn.answer, ...(turn.alternatives ?? [])]) {
    const words = strip(reply).map(word => ({ word, heard: heard.has(word) }))
    const ratio = words.length ? words.filter(w => w.heard).length / words.length : 0
    if (ratio > bestRatio) { bestRatio = ratio; best = words }
  }
  const level = matchesReply(text, turn) ? 'match' : bestRatio >= 0.5 ? 'almost' : 'retry'
  return { level, words: best }
}
