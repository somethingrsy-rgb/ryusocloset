import type { Choice, MathTopic, Pic, Question, Shape, Visual } from './mathGame'

/** 6세·8세 문제 각 20개 (쉬움 8 · 보통 8 · 도전 4). 순서대로 풀고, 보기 위치는 한쪽에 몰리지 않게 정해 두었다. */
const L = (...labels: string[]): Choice[] => labels.map((label) => ({ label }))
const E = (emoji: string, label?: string, extra: { n?: number; scale?: number } = {}): Choice => ({ pic: { emoji, ...extra }, label })
const S = (shape: Shape, label?: string): Choice => ({ pic: { shape }, label })
const sq = (...a: Shape[]) => a

const SIX0: Question[] = [
  { kind: 'choice', text: '사과가 모두 몇 개일까요?', visual: { kind: 'groups', groups: [{ emoji: '🍎', n: 4 }] }, choices: L('3', '4', '5'), answer: 1, why: '사과를 하나씩 짚으며 세면 4개예요.' },
  { kind: 'choice', text: '병아리가 3마리 있는 칸을 골라요.', choices: [E('🐥', undefined, { n: 5 }), E('🐥', undefined, { n: 2 }), E('🐥', undefined, { n: 3 })], answer: 2, why: '세 번째 칸의 병아리를 세면 하나, 둘, 셋이에요.' },
  { kind: 'choice', text: '빠진 수는 무엇일까요?', visual: { kind: 'seq', items: ['1', '2', '?', '4'] }, choices: L('3', '5', '6'), answer: 0, why: '2 다음은 3, 4 앞에는 3이 와요.' },
  { kind: 'choice', text: '어느 쪽이 더 많을까요?', visual: { kind: 'groups', groups: [{ emoji: '🥕', n: 2 }, { emoji: '🥕', n: 5 }] }, choices: L('오른쪽', '왼쪽', '같아요'), answer: 0, why: '당근을 세어 보면 오른쪽이 더 많아요.' },
  { kind: 'choice', text: '딸기가 모두 몇 개일까요?', visual: { kind: 'groups', groups: [{ emoji: '🍓', n: 2 }, { emoji: '🍓', n: 1 }], op: '+' }, choices: L('4', '2', '3'), answer: 2, why: '2개와 1개를 합쳐 세면 3개예요.' },
  { kind: 'choice', text: '동그라미 모양은 어느 것일까요?', choices: [S('tri', '깃발'), E('🍪', '쿠키'), S('square', '상자')], answer: 1, why: '쿠키는 동글동글한 동그라미 모양이에요.' },
  { kind: 'choice', text: '가장 큰 곰 인형을 골라요.', choices: [E('🧸', undefined, { scale: 2.4 }), E('🧸', undefined, { scale: 1.6 }), E('🧸', undefined, { scale: 1 })], answer: 0, why: '다른 곰보다 쑥 큰 곰이 가장 커요.' },
  { kind: 'choice', text: '다음에 올 것은 무엇일까요?', visual: { kind: 'seq', items: ['🍎', '🍌', '🍎', '🍌', '🍎', '?'] }, choices: [E('🍎', '사과'), E('🍇', '포도'), E('🍌', '바나나')], answer: 2, why: '사과, 바나나가 번갈아 나오니 다음은 바나나예요.' },
  { kind: 'input', text: '오리는 모두 몇 마리일까요? 숫자로 써요.', visual: { kind: 'groups', groups: [{ emoji: '🦆', n: 7 }] }, answer: 7, why: '오리를 하나씩 세면 7마리예요.' },
  { kind: 'order', text: '작은 수부터 차례대로 눌러요.', cards: [3, 1, 4, 2], why: '1부터 하나씩 커지게 놓아요.' },
  { kind: 'choice', text: '빠진 수는 무엇일까요?', visual: { kind: 'seq', items: ['5', '6', '?', '8', '9'] }, choices: L('4', '10', '7'), answer: 2, why: '6 다음은 7이고, 7 다음은 8이에요.' },
  { kind: 'choice', text: '어느 쪽이 더 적을까요?', visual: { kind: 'groups', groups: [{ emoji: '🐰', n: 6 }, { emoji: '🐰', n: 4 }] }, choices: L('같아요', '왼쪽', '오른쪽'), answer: 2, why: '세어 보면 오른쪽이 4마리로 더 적어요.' },
  { kind: 'choice', text: '오리가 모두 몇 마리일까요?', visual: { kind: 'groups', groups: [{ emoji: '🦆', n: 3 }, { emoji: '🦆', n: 2 }], op: '+' }, choices: L('4', '5', '6'), answer: 1, why: '3마리와 2마리를 합치면 5마리예요.' },
  { kind: 'choice', text: '풍선이 5개 있었는데 2개가 터졌어요. 남은 풍선은 몇 개일까요?', visual: { kind: 'groups', groups: [{ emoji: '🎈', n: 5, cross: 2 }] }, choices: L('3', '2', '4'), answer: 0, why: '5개에서 2개가 없어졌으니 3개가 남아요.' },
  { kind: 'choice', text: '세모는 모두 몇 개일까요?', visual: { kind: 'shapes', list: sq('tri', 'circle', 'square', 'tri', 'square', 'circle', 'tri') }, choices: L('2', '3', '4'), answer: 1, why: '세모 모양만 세면 3개예요.' },
  { kind: 'choice', text: '가장 긴 연필을 골라요.', choices: [{ pic: { bar: 0.7 } }, { pic: { bar: 0.4 } }, { pic: { bar: 1 } }], answer: 2, why: '한쪽 끝을 맞췄을 때 가장 멀리 간 연필이 가장 길어요.' },
  { kind: 'choice', text: '달걀은 모두 몇 개일까요?', visual: { kind: 'groups', groups: [{ emoji: '🥚', n: 5 }, { emoji: '🥚', n: 4 }], op: '+' }, choices: L('9', '8', '10'), answer: 0, why: '5개와 4개를 이어 세면 9개예요.' },
  { kind: 'choice', text: '쿠키가 9개 있었는데 4개를 먹었어요. 남은 쿠키는 몇 개일까요?', visual: { kind: 'groups', groups: [{ emoji: '🍪', n: 9, cross: 4 }] }, choices: L('4', '5', '6'), answer: 1, why: '9개에서 4개를 빼면 5개가 남아요.' },
  { kind: 'choice', text: '다음에 올 모양은 무엇일까요?', visual: { kind: 'seq', items: ['🔴', '🔵', '🔵', '🔴', '🔵', '🔵', '🔴', '?'] }, choices: [E('🔴'), E('🔵'), E('🟡')], answer: 1, why: '빨강, 파랑, 파랑이 반복되니 빨강 다음은 파랑이에요.' },
  { kind: 'choice', text: '가장 작은 동물은 누구일까요?', choices: [E('🐥', '병아리', { scale: 1 }), E('🦒', '기린', { scale: 2.4 }), E('🐶', '강아지', { scale: 1.6 })], answer: 0, why: '바닥에서부터 키를 비교하면 병아리가 가장 작아요.' },
]

const EIGHT0: Question[] = [
  { kind: 'choice', text: '‘마흔일곱’은 어떤 수일까요?', choices: L('74', '47', '40', '17'), answer: 1, why: '마흔은 40, 일곱은 7이니 47이에요.' },
  { kind: 'choice', text: '58 바로 다음 수는 무엇일까요?', choices: L('57', '68', '60', '59'), answer: 3, why: '58보다 1 큰 수는 59예요.' },
  { kind: 'choice', text: '가장 큰 수는 무엇일까요?', choices: L('92', '29', '19', '82'), answer: 0, why: '십의 자리가 가장 큰 9이고, 92가 82보다 커요.' },
  { kind: 'choice', text: '쿠키는 모두 몇 개일까요?', visual: { kind: 'tens', tens: 2, ones: 3, emoji: '🍪' }, choices: L('5', '32', '23', '203'), answer: 2, why: '10개씩 2묶음은 20, 낱개 3개를 더하면 23이에요.' },
  { kind: 'choice', text: '7 + 2 = □', choices: L('8', '9', '10', '7'), answer: 1, why: '7에서 2만큼 더 세면 9예요.' },
  { kind: 'choice', text: '네모 모양은 어느 것일까요?', choices: [E('🍪', '쿠키'), S('tri', '깃발'), E('🍽️', '접시'), S('square', '액자')], answer: 3, why: '액자는 반듯한 네모 모양이에요.' },
  { kind: 'choice', text: '규칙을 찾아 □에 알맞은 수를 골라요.', visual: { kind: 'seq', items: ['1', '2', '1', '2', '1', '?'] }, choices: L('2', '1', '3', '4'), answer: 0, why: '1, 2가 되풀이되니 1 다음은 2예요.' },
  { kind: 'choice', text: '가장 긴 막대를 골라요.', choices: [{ pic: { bar: 0.6 } }, { pic: { bar: 0.4 } }, { pic: { bar: 1 } }, { pic: { bar: 0.7 } }], answer: 2, why: '왼쪽 끝을 맞췄을 때 가장 멀리 간 막대가 가장 길어요.' },
  { kind: 'choice', text: '몇 시일까요?', visual: { kind: 'clock', h: 3, m: 0 }, choices: L('3시', '12시', '6시', '9시'), answer: 0, why: '긴바늘이 12에 있고 짧은바늘이 3이면 3시예요.' },
  { kind: 'order', text: '작은 수부터 차례대로 눌러요.', cards: [45, 18, 72, 31], why: '십의 자리를 먼저 비교하면 1, 3, 4, 7 순서예요.' },
  { kind: 'input', text: '57 − 24 = □', answer: 33, why: '일의 자리 7−4=3, 십의 자리 5−2=3이니 33이에요.' },
  { kind: 'choice', text: '23 + 41 = □', choices: L('54', '65', '74', '64'), answer: 3, why: '일의 자리 3+1=4, 십의 자리 2+4=6이니 64예요.' },
  { kind: 'input', text: '십의 자리가 3이고 일의 자리가 6인 수는 얼마일까요? 숫자로 써요.', visual: { kind: 'tens', tens: 3, ones: 6, emoji: '🟡' }, answer: 36, why: '10이 3개면 30, 낱개 6개를 더하면 36이에요.' },
  { kind: 'choice', text: '다음에 올 모양은 무엇일까요?', visual: { kind: 'seq', items: ['🔺', '🟦', '🟦', '🔺', '🟦', '🟦', '🔺', '🟦', '?'] }, choices: [E('🔺', '세모'), E('🟦', '네모'), E('🟠', '동그라미'), E('⭐', '별')], answer: 1, why: '세모, 네모, 네모가 되풀이되니 마지막 네모 다음도 네모예요.' },
  { kind: 'choice', text: '물이 가장 많이 든 컵을 골라요.', choices: [{ pic: { cup: 0.5 } }, { pic: { cup: 0.25 } }, { pic: { cup: 1 } }, { pic: { cup: 0.75 } }], answer: 2, why: '같은 컵에서 물이 가장 높이 찬 컵이 가장 많이 들었어요.' },
  { kind: 'choice', text: '사과가 12개 있어요. 7개를 더 샀어요. 사과는 모두 몇 개일까요?', choices: L('18', '19', '20', '5'), answer: 1, why: '12에 7을 더하면 19예요.' },
  { kind: 'choice', text: '8 + 7 = □', choices: L('14', '16', '13', '15'), answer: 3, why: '8에 2를 더해 10을 만들고 5를 더하면 15예요.' },
  { kind: 'choice', text: '쿠키가 16개 있어요. 8개를 먹었어요. 남은 쿠키는 몇 개일까요?', choices: L('8', '7', '9', '6'), answer: 0, why: '16에서 6을 빼 10, 다시 2를 빼면 8이에요.' },
  { kind: 'choice', text: '변이 3개인 도형은 모두 몇 개일까요?', visual: { kind: 'shapes', list: sq('tri', 'square', 'square', 'circle', 'tri', 'square') }, choices: L('1', '3', '2', '4'), answer: 2, why: '변이 3개인 도형은 세모이고, 그림에 세모가 2개 있어요.' },
  { kind: 'choice', text: '몇 시일까요?', visual: { kind: 'clock', h: 4, m: 30 }, choices: L('4시', '4시 30분', '5시', '5시 30분'), answer: 1, why: '긴바늘이 6에 있으면 30분이고, 짧은바늘이 4를 지났으니 4시 30분이에요.' },
]

// ───────── 새 문제 만들기 도구 ─────────
/** 정답 위치가 한쪽에 몰리지 않도록, 지금까지 정답이 가장 적게 나온 번호에 정답을 넣는다 */
const tally = (list: Question[], n: number) => {
  const c = new Array<number>(n).fill(0)
  for (const q of list) if (q.kind === 'choice') c[q.answer]++
  return c
}
const place = (counts: number[], correct: Choice, wrong: Choice[]) => {
  const k = counts.indexOf(Math.min(...counts))
  counts[k]++
  const choices = [...wrong]
  choices.splice(k, 0, correct)
  return { choices, answer: k }
}
/** 정답 곁의 숫자 오답 (min 이상, 정답과 다르게) */
const near = (answer: number, need: number, min = 0) => {
  const out: number[] = []
  for (const d of [1, -1, 2, -2, 3, -3, 4, 5, 6]) if (out.length < need && answer + d >= min && !out.includes(answer + d)) out.push(answer + d)
  return out
}
type Kind = { text: string; why: string; visual?: Visual }
const make = (counts: number[], k: Kind, correct: Choice, wrong: Choice[]): Question => ({ kind: 'choice', text: k.text, why: k.why, visual: k.visual, ...place(counts, correct, wrong) })
const makeNum = (counts: number[], k: Kind, answer: number, min = 0): Question => make(counts, k, { label: String(answer) }, near(answer, counts.length - 1, min).map((n) => ({ label: String(n) })))
const makeInput = (k: Kind, answer: number): Question => ({ kind: 'input', text: k.text, why: k.why, visual: k.visual, answer })
const makeOrder = (text: string, cards: number[]): Question => ({ kind: 'order', text, cards, why: '작은 수부터 차례대로 놓아요.' })
const groups = (...g: { emoji: string; n: number; cross?: number }[]): Visual => ({ kind: 'groups', groups: g })
const seq = (...items: string[]): Visual => ({ kind: 'seq', items })
const pics = (emoji: string, n: number): Pic => ({ emoji, n })

const c6 = tally(SIX0, 3)
const c8 = tally(EIGHT0, 4)
const six = (k: Kind, correct: Choice, wrong: Choice[]) => make(c6, k, correct, wrong)
const sixNum = (k: Kind, answer: number, min = 0) => makeNum(c6, k, answer, min)
const eight = (k: Kind, correct: Choice, wrong: Choice[]) => make(c8, k, correct, wrong)
const eightNum = (k: Kind, answer: number, min = 0) => makeNum(c8, k, answer, min)
const lab = (...a: string[]): Choice[] => a.map((label) => ({ label }))
/** 받침이 있으면 앞, 없으면 뒤 글자를 붙인다 */
const josa = (w: string, withBatchim: string, without: string) => w + ((w.charCodeAt(w.length - 1) - 0xac00) % 28 !== 0 ? withBatchim : without)
const eun = (w: string) => josa(w, '은', '는')
const iga = (w: string) => josa(w, '이', '가')

// ───────── 6세 새 문제 60개 ─────────
const cnt = (emoji: string, n: number, name: string, unit = '개') => sixNum({ text: `${eun(name)} 모두 몇 ${unit}일까요?`, visual: groups({ emoji, n }), why: `${name}${josa(name, '을', '를')} 하나씩 세면 ${n}${unit}예요.` }, n, 1)
const box = (emoji: string, n: number, name: string, others: [number, number]) => six({ text: `${iga(name)} ${n}개 있는 칸을 골라요.`, why: `${n}개가 들어 있는 칸을 세어 찾아요.` }, { pic: pics(emoji, n) }, others.map((o) => ({ pic: pics(emoji, o) })))
const gap = (items: string[], answer: number, why: string) => sixNum({ text: '빠진 수는 무엇일까요?', visual: seq(...items), why }, answer, 1)
const cmp = (a: number, b: number, emoji: string, ask: '많은' | '적은') => {
  const ans = a === b ? '같아요' : (ask === '많은' ? a > b : a < b) ? '왼쪽' : '오른쪽'
  const rest = ['왼쪽', '오른쪽', '같아요'].filter((x) => x !== ans)
  return six({ text: `어느 쪽이 더 ${ask === '많은' ? '많을까요' : '적을까요'}?`, visual: groups({ emoji, n: a }, { emoji, n: b }), why: a === b ? '세어 보면 양쪽이 같아요.' : `세어 보면 ${ans}이 ${ask === '많은' ? '더 많아요' : '더 적어요'}.` }, { label: ans }, lab(...rest))
}
const addQ = (a: number, b: number, emoji: string, name: string) => sixNum({ text: `${eun(name)} 모두 몇 개일까요?`, visual: { kind: 'groups', groups: [{ emoji, n: a }, { emoji, n: b }], op: '+' }, why: `${a}개와 ${b}개를 합쳐 세면 ${a + b}개예요.` }, a + b, 1)
const subQ = (a: number, b: number, emoji: string, sentence: string) => sixNum({ text: sentence, visual: groups({ emoji, n: a, cross: b }), why: `${a}개에서 ${b}개를 빼면 ${a - b}개가 남아요.` }, a - b, 0)
const pickShape = (word: string, correct: Choice, wrong: Choice[]) => six({ text: `${word} 모양은 어느 것일까요?`, why: `${word} 모양을 찾아요.` }, correct, wrong)
const countShape = (word: string, target: Shape, list: Shape[]) => sixNum({ text: `${eun(word)} 모두 몇 개일까요?`, visual: { kind: 'shapes', list }, why: `${word} 모양만 세면 ${list.filter((x) => x === target).length}개예요.` }, list.filter((x) => x === target).length, 1)
const oddOne = (word: string, correct: Choice, wrong: Choice[]) => six({ text: '모양이 다른 하나를 골라요.', why: `${word} 모양만 달라요.` }, correct, wrong)
const sizeQ = (text: string, emoji: string, big: boolean, labels?: [string, string, string]) => {
  const scales = big ? [2.4, 1.6, 1] : [1, 1.6, 2.4]
  return six({ text, why: big ? '다른 것보다 쑥 큰 것이 가장 커요.' : '다른 것보다 작은 것이 가장 작아요.' }, { pic: { emoji, scale: scales[0] }, label: labels?.[0] }, [{ pic: { emoji, scale: scales[1] }, label: labels?.[1] }, { pic: { emoji, scale: scales[2] }, label: labels?.[2] }])
}
const barQ = (text: string, longest: boolean) => six({ text, why: longest ? '한쪽 끝을 맞췄을 때 가장 멀리 간 것이 가장 길어요.' : '한쪽 끝을 맞췄을 때 가장 조금 간 것이 가장 짧아요.' }, { pic: { bar: longest ? 1 : 0.3 } }, [{ pic: { bar: 0.6 } }, { pic: { bar: longest ? 0.4 : 0.8 } }])
const patQ = (items: string[], answer: string, other: string, third: string, why: string) => six({ text: '다음에 올 것은 무엇일까요?', visual: seq(...items, '?'), why }, { pic: { emoji: answer } }, [{ pic: { emoji: other } }, { pic: { emoji: third } }])

const SIX_COUNT: Question[] = [SIX0[0], cnt('🐥', 6, '병아리', '마리'), SIX0[1], box('⭐', 4, '별', [6, 3]), cnt('🍓', 8, '딸기'), box('⚽', 7, '공', [5, 8]), SIX0[8], makeInput({ text: '물고기는 모두 몇 마리일까요? 숫자로 써요.', visual: groups({ emoji: '🐟', n: 5 }), why: '물고기를 하나씩 세면 5마리예요.' }, 5), makeInput({ text: '나비는 모두 몇 마리일까요? 숫자로 써요.', visual: groups({ emoji: '🦋', n: 9 }), why: '나비를 하나씩 세면 9마리예요.' }, 9), makeInput({ text: '꽃은 모두 몇 송이일까요? 숫자로 써요.', visual: groups({ emoji: '🌸', n: 10 }), why: '꽃을 하나씩 세면 10송이예요.' }, 10)]
const SIX_ORDER: Question[] = [SIX0[2], gap(['2', '3', '?', '5'], 4, '3 다음은 4, 5 앞에는 4가 와요.'), gap(['?', '2', '3'], 1, '2 앞의 수는 1이에요.'), SIX0[10], gap(['6', '7', '8', '?'], 9, '8 다음은 9예요.'), SIX0[9], gap(['7', '?', '9', '10'], 8, '7 다음은 8, 9 앞에는 8이 와요.'), makeOrder('작은 수부터 차례대로 눌러요.', [2, 5, 1]), gap(['3', '4', '5', '?', '7'], 6, '5 다음은 6, 7 앞에는 6이 와요.'), makeOrder('작은 수부터 차례대로 눌러요.', [9, 7, 10, 8])]
const SIX_COMPARE: Question[] = [SIX0[3], cmp(7, 3, '🍎', '많은'), cmp(4, 8, '🐟', '적은'), cmp(5, 5, '🎈', '많은'), SIX0[11], cmp(8, 6, '🌼', '적은'), cmp(3, 7, '⭐', '많은'), cmp(2, 2, '🐞', '적은'), cmp(9, 10, '🍒', '많은'), cmp(10, 7, '🐠', '적은')]
const SIX_ADD: Question[] = [addQ(1, 1, '🐥', '병아리'), SIX0[4], addQ(3, 1, '🌸', '꽃'), addQ(2, 2, '🍓', '딸기'), SIX0[12], addQ(4, 3, '🐟', '물고기'), addQ(5, 3, '⭐', '별'), addQ(6, 2, '🍪', '쿠키'), SIX0[16], addQ(4, 6, '🍬', '사탕')]
const SIX_SUB: Question[] = [SIX0[13], subQ(4, 1, '🍎', '사과가 4개 있었는데 1개를 먹었어요. 남은 사과는 몇 개일까요?'), subQ(6, 2, '🍪', '쿠키가 6개 있었는데 2개를 먹었어요. 남은 쿠키는 몇 개일까요?'), subQ(7, 3, '🐥', '병아리가 7마리 있었는데 3마리가 날아갔어요. 남은 병아리는 몇 마리일까요?'), subQ(3, 2, '🍓', '딸기가 3개 있었는데 2개를 먹었어요. 남은 딸기는 몇 개일까요?'), subQ(8, 5, '🦋', '나비가 8마리 있었는데 5마리가 날아갔어요. 남은 나비는 몇 마리일까요?'), SIX0[17], subQ(10, 4, '🍬', '사탕이 10개 있었는데 4개를 먹었어요. 남은 사탕은 몇 개일까요?'), subQ(9, 7, '⭐', '별이 9개 있었는데 7개가 떨어졌어요. 남은 별은 몇 개일까요?'), subQ(10, 8, '🥚', '달걀이 10개 있었는데 8개를 먹었어요. 남은 달걀은 몇 개일까요?')]
const SIX_SHAPE: Question[] = [SIX0[5], pickShape('세모', { pic: { shape: 'tri' }, label: '지붕' }, [{ pic: { emoji: '🍽️' }, label: '접시' }, { pic: { shape: 'square' }, label: '창문' }]), pickShape('네모', { pic: { shape: 'square' }, label: '액자' }, [{ pic: { emoji: '🍪' }, label: '쿠키' }, { pic: { shape: 'tri' }, label: '깃발' }]), countShape('동그라미', 'circle', ['circle', 'tri', 'circle', 'square', 'circle', 'square', 'circle', 'tri']), SIX0[14], countShape('네모', 'square', ['square', 'circle', 'tri', 'square', 'circle', 'square', 'tri']), oddOne('세모', { pic: { shape: 'tri' } }, [{ pic: { shape: 'circle' } }, { pic: { shape: 'circle' } }]), oddOne('네모', { pic: { shape: 'square' } }, [{ pic: { shape: 'tri' } }, { pic: { shape: 'tri' } }]), countShape('세모', 'tri', ['tri', 'square', 'tri', 'circle', 'tri', 'tri', 'square', 'tri', 'circle', 'tri']), countShape('동그라미', 'circle', ['square', 'circle', 'tri', 'circle', 'square'])]
const SIX_SIZE: Question[] = [SIX0[6], sizeQ('가장 작은 사과를 골라요.', '🍎', false), SIX0[15], sizeQ('가장 큰 고양이를 골라요.', '🐱', true), barQ('가장 짧은 리본을 골라요.', false), SIX0[19], sizeQ('가장 키가 큰 나무를 골라요.', '🌳', true), barQ('가장 긴 줄을 골라요.', true), sizeQ('가장 작은 집을 골라요.', '🏠', false), barQ('가장 짧은 막대를 골라요.', false)]
const SIX_PATTERN: Question[] = [SIX0[7], patQ(['🐶', '🐱', '🐶', '🐱', '🐶'], '🐱', '🐶', '🐰', '강아지, 고양이가 번갈아 나오니 다음은 고양이예요.'), patQ(['🔺', '🔵', '🔺', '🔵', '🔺'], '🔵', '🔺', '🟡', '세모, 동그라미가 번갈아 나오니 다음은 동그라미예요.'), patQ(['⭐', '⭐', '🌙', '⭐', '⭐', '🌙', '⭐'], '⭐', '🌙', '☀️', '별, 별, 달이 반복되니 다음은 별이에요.'), SIX0[18], patQ(['🟦', '🟩', '🟩', '🟦', '🟩', '🟩', '🟦'], '🟩', '🟦', '🟨', '파랑, 초록, 초록이 반복되니 다음은 초록이에요.'), patQ(['🐟', '🐟', '🐸', '🐟', '🐟', '🐸', '🐟', '🐟'], '🐸', '🐟', '🐢', '물고기, 물고기, 개구리가 반복되니 다음은 개구리예요.'), patQ(['🌸', '🌿', '🌸', '🌿', '🌸', '🌿'], '🌸', '🌿', '🍀', '꽃, 잎이 번갈아 나오니 다음은 꽃이에요.'), patQ(['🔶', '🔷', '🔷', '🔶', '🔷', '🔷', '🔶'], '🔷', '🔶', '🟣', '주황, 파랑, 파랑이 반복되니 다음은 파랑이에요.'), patQ(['🍎', '🍌', '🍎', '🍌', '🍎', '🍌', '🍎'], '🍌', '🍎', '🍇', '사과, 바나나가 번갈아 나오니 다음은 바나나예요.')]

export const SIX_TOPICS: MathTopic[] = [
  { icon: '🍎', title: { ko: '수 세기', en: 'Counting' }, hint: { ko: '1부터 10까지 세어요', en: 'Count 1 to 10' }, questions: SIX_COUNT },
  { icon: '🔢', title: { ko: '순서와 빠진 수', en: 'Order & missing numbers' }, hint: { ko: '수의 순서를 알아요', en: 'Know the order' }, questions: SIX_ORDER },
  { icon: '⚖️', title: { ko: '많다 · 적다', en: 'More or fewer' }, hint: { ko: '어느 쪽이 더 많을까요', en: 'Which has more?' }, questions: SIX_COMPARE },
  { icon: '➕', title: { ko: '더하기', en: 'Adding' }, hint: { ko: '합이 10 이하', en: 'Sums up to 10' }, questions: SIX_ADD },
  { icon: '➖', title: { ko: '빼기', en: 'Subtracting' }, hint: { ko: '10 이하에서 덜어내요', en: 'Take away within 10' }, questions: SIX_SUB },
  { icon: '🔺', title: { ko: '도형', en: 'Shapes' }, hint: { ko: '동그라미 · 세모 · 네모', en: 'Circle, triangle, square' }, questions: SIX_SHAPE },
  { icon: '📏', title: { ko: '크기와 길이', en: 'Size & length' }, hint: { ko: '크기 · 길이 · 높이 비교', en: 'Compare size and length' }, questions: SIX_SIZE },
  { icon: '🧩', title: { ko: '규칙 찾기', en: 'Patterns' }, hint: { ko: '반복되는 모양을 찾아요', en: 'Find the repeat' }, questions: SIX_PATTERN },
]

// ───────── 8세 새 문제 60개 ─────────
const pickN = (text: string, correct: string, wrong: string[], why: string, visual?: Visual) => eight({ text, why, visual }, { label: correct }, lab(...wrong))
const swapTens = (n: number) => (n % 10) * 10 + Math.floor(n / 10)
const tensQ = (tens: number, ones: number, emoji: string, name: string, input = false) => {
  const k: Kind = { text: `${eun(name)} 모두 몇 개일까요?${input ? ' 숫자로 써요.' : ''}`, visual: { kind: 'tens', tens, ones, emoji }, why: `10개씩 ${tens}묶음은 ${tens * 10}, 낱개 ${ones}개를 더하면 ${tens * 10 + ones}이에요.` }
  const ans = tens * 10 + ones
  if (input) return makeInput(k, ans)
  const wrong = [...new Set([swapTens(ans), tens + ones, ans + 10])].filter((n) => n !== ans)
  return pickN(k.text, String(ans), wrong.map(String), k.why, k.visual)
}
const sumWhy = (a: number, b: number) => {
  const [a1, a10, b1, b10] = [a % 10, Math.floor(a / 10), b % 10, Math.floor(b / 10)]
  return `일의 자리 ${a1}+${b1}=${a1 + b1}, 십의 자리 ${a10}+${b10}=${a10 + b10}이니 ${a + b}예요.`
}
const diffWhy = (a: number, b: number) => {
  const [a1, a10, b1, b10] = [a % 10, Math.floor(a / 10), b % 10, Math.floor(b / 10)]
  return `일의 자리 ${a1}−${b1}=${a1 - b1}, 십의 자리 ${a10}−${b10}=${a10 - b10}이니 ${a - b}예요.`
}
const addS = (a: number, b: number, why: string, input = false) => (input ? makeInput({ text: `${a} + ${b} = □`, why }, a + b) : eightNum({ text: `${a} + ${b} = □`, why }, a + b))
const subS = (a: number, b: number, why: string, input = false) => (input ? makeInput({ text: `${a} − ${b} = □`, why }, a - b) : eightNum({ text: `${a} − ${b} = □`, why }, a - b))
const addCarry = (a: number, b: number) => addS(a, b, `${a}에 ${10 - a}를 더해 10을 만들고 남은 ${b - (10 - a)}를 더하면 ${a + b}예요.`)
const subBorrow = (a: number, b: number) => subS(a, b, `${a}에서 ${a - 10}을 빼 10을 만들고, 다시 ${b - (a - 10)}를 빼면 ${a - b}예요.`)
const word = (text: string, answer: number, why: string) => eightNum({ text, why }, answer, 0)
const patNum = (items: (string | number)[], answer: number, why: string) => eightNum({ text: '규칙을 찾아 □에 알맞은 수를 골라요.', visual: seq(...items.map(String), '?'), why }, answer, 1)
const patPic = (items: string[], answer: string, others: [string, string, string], why: string) => eight({ text: '다음에 올 모양은 무엇일까요?', visual: seq(...items, '?'), why }, { pic: { emoji: answer } }, others.map((emoji) => ({ pic: { emoji } })))
const clockQ = (h: number, m: 0 | 30, wrong: string[]) => {
  const label = m === 0 ? `${h}시` : `${h}시 30분`
  return pickN('몇 시일까요?', label, wrong, m === 0 ? `긴바늘이 12에 있고 짧은바늘이 ${h}이면 ${h}시예요.` : `긴바늘이 6에 있으면 30분이고, 짧은바늘이 ${h}를 지났으니 ${label}이에요.`, { kind: 'clock', h, m })
}
const barQ8 = (text: string, longest: boolean) => eight({ text, why: longest ? '왼쪽 끝을 맞췄을 때 가장 멀리 간 것이 가장 길어요.' : '왼쪽 끝을 맞췄을 때 가장 조금 간 것이 가장 짧아요.' }, { pic: { bar: longest ? 1 : 0.3 } }, longest ? [0.6, 0.45, 0.75].map((bar) => ({ pic: { bar } })) : [0.55, 0.8, 0.65].map((bar) => ({ pic: { bar } })))
const cupQ = (text: string, most: boolean) => eight({ text, why: most ? '같은 컵에서 물이 가장 높이 찬 컵이 가장 많이 들었어요.' : '같은 컵에서 물이 가장 낮은 컵이 가장 적게 들었어요.' }, { pic: { cup: most ? 0.75 : 0.25 } }, (most ? [0.5, 0.25, 0.4] : [0.5, 0.75, 1]).map((cup) => ({ pic: { cup } })))
const scaleQ = (left: string, right: string, heavier: 'left' | 'right') => pickN('저울이 아래로 내려간 쪽이 더 무거워요. 더 무거운 쪽은 어디일까요?', heavier === 'left' ? '왼쪽' : '오른쪽', [heavier === 'left' ? '오른쪽' : '왼쪽', '같아요', '알 수 없어요'], '저울이 내려간 쪽이 더 무거워요.', { kind: 'balance', left, right, heavier })
const shapePick = (word: string, correct: Choice, wrong: Choice[]) => eight({ text: `${word} 모양은 어느 것일까요?`, why: `${word} 모양을 찾아요.` }, correct, wrong)

const EIGHT_NUM: Question[] = [EIGHT0[0], pickN('‘스물아홉’은 어떤 수일까요?', '29', ['92', '20', '9'], '스물은 20, 아홉은 9이니 29예요.'), EIGHT0[1], pickN('79 바로 다음 수는 무엇일까요?', '80', ['78', '70', '89'], '79보다 1 큰 수는 80이에요.'), EIGHT0[2], pickN('가장 작은 수는 무엇일까요?', '14', ['41', '44', '24'], '십의 자리가 가장 작은 1이니 14가 가장 작아요.'), pickN('‘예순셋’은 어떤 수일까요?', '63', ['36', '60', '53'], '예순은 60, 셋은 3이니 63이에요.'), EIGHT0[9], pickN('빠진 수는 무엇일까요?', '99', ['96', '90', '89'], '98 다음은 99, 100 앞에는 99가 와요.', seq('97', '98', '?', '100')), pickN('‘여든다섯’은 어떤 수일까요?', '85', ['58', '80', '75'], '여든은 80, 다섯은 5이니 85예요.')]
const EIGHT_TENS: Question[] = [EIGHT0[3], tensQ(1, 7, '🍓', '딸기'), EIGHT0[12], tensQ(3, 4, '🍪', '쿠키'), pickN('십의 자리가 5인 수는 무엇일까요?', '52', ['25', '12', '72'], '52는 십의 자리가 5, 일의 자리가 2예요.'), pickN('일의 자리가 7인 수는 무엇일까요?', '17', ['70', '72', '75'], '17은 십의 자리가 1, 일의 자리가 7이에요.'), tensQ(6, 5, '🥚', '달걀'), tensQ(5, 2, '🍬', '사탕', true)]
const EIGHT_ADD20: Question[] = [EIGHT0[4], addS(5, 4, '5에서 4만큼 더 세면 9예요.'), addS(12, 5, '12에서 5만큼 더 세면 17이에요.'), subS(16, 4, '16에서 4를 빼면 12예요.'), subS(18, 5, '18에서 5를 빼면 13이에요.'), addS(14, 3, '14에서 3만큼 더 세면 17이에요.'), addCarry(9, 6), EIGHT0[16], subBorrow(15, 7), subBorrow(13, 5)]
const EIGHT_CALC: Question[] = [EIGHT0[11], addS(32, 25, sumWhy(32, 25)), EIGHT0[10], subS(78, 35, diffWhy(78, 35)), addS(41, 36, sumWhy(41, 36)), subS(69, 42, diffWhy(69, 42)), addS(62, 17, sumWhy(62, 17), true), subS(85, 64, diffWhy(85, 64)), addS(14, 75, sumWhy(14, 75)), subS(96, 72, diffWhy(96, 72), true)]
const EIGHT_WORD: Question[] = [EIGHT0[15], word('귤이 14개 있어요. 3개를 더 받았어요. 귤은 모두 몇 개일까요?', 17, '14에 3을 더하면 17이에요.'), word('놀이터에 아이들이 11명 있어요. 4명이 더 왔어요. 아이들은 모두 몇 명일까요?', 15, '11에 4를 더하면 15예요.'), word('색종이가 18장 있어요. 5장을 썼어요. 남은 색종이는 몇 장일까요?', 13, '18에서 5를 빼면 13이에요.'), word('사탕이 19개 있어요. 7개를 먹었어요. 남은 사탕은 몇 개일까요?', 12, '19에서 7을 빼면 12예요.'), word('토끼가 8마리 있어요. 5마리가 더 왔어요. 토끼는 모두 몇 마리일까요?', 13, '8에 2를 더해 10, 남은 3을 더하면 13이에요.'), word('풍선이 15개 있어요. 6개가 터졌어요. 남은 풍선은 몇 개일까요?', 9, '15에서 5를 빼 10, 다시 1을 빼면 9예요.'), EIGHT0[17], word('공이 9개 있어요. 8개를 더 샀어요. 공은 모두 몇 개일까요?', 17, '9에 1을 더해 10, 남은 7을 더하면 17이에요.'), word('연필이 17자루 있어요. 9자루를 나눠 주었어요. 남은 연필은 몇 자루일까요?', 8, '17에서 7을 빼 10, 다시 2를 빼면 8이에요.')]
const EIGHT_SHAPE: Question[] = [EIGHT0[5], shapePick('동그라미', { pic: { emoji: '🍪' }, label: '쿠키' }, [{ pic: { shape: 'tri' }, label: '깃발' }, { pic: { shape: 'square' }, label: '액자' }, { pic: { shape: 'tri' }, label: '지붕' }]), shapePick('세모', { pic: { shape: 'tri' }, label: '깃발' }, [{ pic: { emoji: '🍪' }, label: '쿠키' }, { pic: { shape: 'square' }, label: '액자' }, { pic: { emoji: '🍽️' }, label: '접시' }]), eightNum({ text: '네모에는 변이 모두 몇 개 있을까요?', why: '네모는 반듯한 변이 4개예요.' }, 4), eightNum({ text: '세모에는 꼭짓점이 모두 몇 개 있을까요?', why: '세모는 뾰족한 꼭짓점이 3개예요.' }, 3), EIGHT0[18], eightNum({ text: '네모에는 꼭짓점이 모두 몇 개 있을까요?', why: '네모는 뾰족한 꼭짓점이 4개예요.' }, 4), eightNum({ text: '꼭짓점이 4개인 도형은 모두 몇 개일까요?', visual: { kind: 'shapes', list: sq('square', 'tri', 'circle', 'square', 'tri', 'square', 'circle') }, why: '꼭짓점이 4개인 도형은 네모이고, 그림에 네모가 3개 있어요.' }, 3)]
const EIGHT_PATTERN: Question[] = [EIGHT0[6], patNum([1, 3, 1, 3, 1], 3, '1, 3이 되풀이되니 1 다음은 3이에요.'), patNum([5, 6, 5, 6, 5], 6, '5, 6이 되풀이되니 5 다음은 6이에요.'), EIGHT0[13], patNum([2, 2, 3, 2, 2, 3, 2, 2], 3, '2, 2, 3이 되풀이되니 2, 2 다음은 3이에요.'), patPic(['🍎', '🍐', '🍐', '🍎', '🍐', '🍐', '🍎'], '🍐', ['🍎', '🍇', '🍌'], '사과, 배, 배가 되풀이되니 사과 다음은 배예요.'), patPic(['🔺', '🟠', '🟦', '🔺', '🟠', '🟦', '🔺'], '🟠', ['🔺', '🟦', '⭐'], '세모, 동그라미, 네모가 되풀이되니 세모 다음은 동그라미예요.'), patPic(['🔴', '🔴', '🔵', '🔴', '🔴', '🔵', '🔴', '🔴'], '🔵', ['🔴', '🟡', '🟢'], '빨강, 빨강, 파랑이 되풀이되니 빨강, 빨강 다음은 파랑이에요.')]
const EIGHT_MEASURE: Question[] = [EIGHT0[7], barQ8('가장 짧은 끈을 골라요.', false), EIGHT0[14], cupQ('물이 가장 적게 든 컵을 골라요.', false), scaleQ('🍉', '🍎', 'left'), barQ8('가장 긴 리본을 골라요.', true), scaleQ('🐭', '🐘', 'right'), cupQ('물이 가장 많이 든 컵을 골라요.', true)]
const EIGHT_CLOCK: Question[] = [EIGHT0[8], clockQ(7, 0, ['1시', '7시 30분', '6시']), clockQ(11, 0, ['1시', '11시 30분', '10시']), clockQ(2, 30, ['2시', '3시', '3시 30분']), EIGHT0[19], clockQ(8, 30, ['8시', '9시', '9시 30분']), clockQ(1, 0, ['12시', '1시 30분', '2시']), clockQ(10, 30, ['10시', '11시', '11시 30분'])]

export const EIGHT_TOPICS: MathTopic[] = [
  { icon: '🔢', title: { ko: '수 읽기와 크기', en: 'Reading numbers' }, hint: { ko: '100까지의 수, 순서, 크기', en: 'Numbers to 100' }, questions: EIGHT_NUM },
  { icon: '📦', title: { ko: '묶음과 낱개', en: 'Tens and ones' }, hint: { ko: '십의 자리 · 일의 자리', en: 'Tens place and ones place' }, questions: EIGHT_TENS },
  { icon: '➕', title: { ko: '20까지 더하고 빼기', en: 'Add & subtract to 20' }, hint: { ko: '뒤쪽은 받아올림·받아내림', en: 'Carry and borrow at the end' }, questions: EIGHT_ADD20 },
  { icon: '🧮', title: { ko: '100까지 더하고 빼기', en: 'Add & subtract to 100' }, hint: { ko: '받아올림 없는 계산', en: 'No carrying' }, questions: EIGHT_CALC },
  { icon: '📖', title: { ko: '이야기 문제', en: 'Story problems' }, hint: { ko: '더하기 · 빼기 한 번', en: 'One add or subtract' }, questions: EIGHT_WORD },
  { icon: '🔺', title: { ko: '도형', en: 'Shapes' }, hint: { ko: '모양, 변, 꼭짓점', en: 'Sides and corners' }, questions: EIGHT_SHAPE },
  { icon: '🧩', title: { ko: '규칙 찾기', en: 'Patterns' }, hint: { ko: '수와 모양의 반복', en: 'Repeating numbers and shapes' }, questions: EIGHT_PATTERN },
  { icon: '⚖️', title: { ko: '길이 · 무게 · 들이', en: 'Length, weight, volume' }, hint: { ko: '직접 비교하기', en: 'Compare directly' }, questions: EIGHT_MEASURE },
  { icon: '🕒', title: { ko: '시계 읽기', en: 'Telling time' }, hint: { ko: '정각과 30분', en: "O'clock and half past" }, questions: EIGHT_CLOCK },
]
