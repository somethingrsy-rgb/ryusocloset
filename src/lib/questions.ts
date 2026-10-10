import { isRestoring } from './restoreGuard'

/** 게임에서 나오는 영어 단어·문법 문제 (중학생 이상 / 성인 수준). 내가 만든 문제는 브라우저에 저장된다. */
export type QType = 'vocab' | 'grammar'

export interface Question {
  id: string
  type: QType
  /** 영어 문제 문장 */
  q: string
  choices: string[]
  /** 정답 보기 번호(0부터) */
  answer: number
  /** 해설 (한국어) */
  explain: string
  /** 이 장소에서만 나오게 (없으면 어디서나) */
  place?: string
  custom?: boolean
}

type Row = [QType, string, string[], number, string]
const V = 'vocab' as const
const G = 'grammar' as const

const BANK: Record<string, Row[]> = {
  spring: [
    [V, 'We spread a blanket on the grass and had a ___ lunch under the cherry trees.', ['picnic', 'protest', 'passport'], 0, 'picnic: 소풍 / protest 시위 / passport 여권'],
    [V, "Which word is closest in meaning to 'gentle'?", ['harsh', 'mild', 'rough'], 1, 'gentle ≈ mild (온화한, 부드러운)'],
    [V, 'The flowers ___ in spring, so the park is full of color.', ['wither', 'bloom', 'shrink'], 1, 'bloom: (꽃이) 피다 / wither: 시들다'],
    [G, 'If it ___ tomorrow, we will have the picnic indoors.', ['rains', 'will rain', 'rained'], 0, '조건 부사절(if)에서는 미래의 일도 현재시제로 쓴다.'],
    [G, 'She is looking forward to ___ the cherry blossoms.', ['see', 'seeing', 'saw'], 1, 'look forward to + 동명사(-ing): ~을 기대하다'],
    [G, 'The picnic basket, ___ my mother packed this morning, is on the table.', ['who', 'which', 'what'], 1, '사물이 선행사인 계속적 용법에는 which를 쓴다.'],
  ],
  summer: [
    [V, "Don't forget to apply ___ before you go to the beach.", ['sunscreen', 'sunrise', 'sunflower'], 0, 'sunscreen: 자외선 차단제'],
    [V, 'A strong ___ pulled the swimmer away from the shore.', ['current', 'curtain', 'courage'], 0, 'current: 해류, 물살'],
    [V, "The opposite of 'crowded' is ___.", ['packed', 'deserted', 'noisy'], 1, 'deserted: 인적이 드문, 텅 빈'],
    [G, 'I ___ in the sea when the lifeguard blew his whistle.', ['swam', 'was swimming', 'have swum'], 1, '진행 중이던 동작에 다른 일이 끼어들 때는 과거진행형.'],
    [G, 'By next Friday, we ___ here for a whole week.', ['stay', 'will have stayed', 'have stayed'], 1, 'By + 미래 시점: 미래완료(will have p.p.)'],
    [G, 'This beach is ___ than the one we visited last year.', ['more crowded', 'crowdeder', 'most crowded'], 0, '2음절 이상 형용사의 비교급은 more + 형용사.'],
  ],
  camp: [
    [V, 'We pitched our ___ next to the lake.', ['tent', 'tenant', 'tender'], 0, 'pitch a tent: 텐트를 치다'],
    [V, 'Be careful! The campfire is not completely ___.', ['extinguished', 'expanded', 'exhibited'], 0, 'extinguish: (불을) 끄다'],
    [V, "'We decided to rough it in the mountains.' Here, 'rough it' means to ___.", ['live without comforts', 'run quickly', 'climb steeply'], 0, 'rough it: 불편한 생활을 감수하다'],
    [G, 'You ___ leave food outside, or bears will come.', ["mustn't", "don't have to", "needn't"], 0, "mustn't: 금지 / don't have to, needn't: 불필요"],
    [G, 'The tent ___ by my father last night.', ['set up', 'was set up', 'has set up'], 1, '행위자가 by로 나오는 수동태: was set up'],
    [G, 'I wish I ___ a warmer sleeping bag.', ['bring', 'brought', 'had brought'], 2, '과거 사실에 대한 아쉬움: wish + had p.p.'],
  ],
  birthday: [
    [V, 'Please ___ the candles and make a wish.', ['blow out', 'blow up', 'blow over'], 0, 'blow out: 불어서 끄다 / blow up: 폭파하다·부풀리다'],
    [V, 'A ___ is a person who invites guests to a party.', ['host', 'ghost', 'guest'], 0, 'host: (행사의) 주최자 / guest: 손님'],
    [V, "Which word is closest in meaning to 'celebrate'?", ['mourn', 'rejoice', 'ignore'], 1, 'rejoice: 크게 기뻐하다 / mourn: 애도하다'],
    [G, "I'm looking for the gift ___ I bought for her last week.", ['that', 'what', 'whom'], 0, '사물 선행사 + 목적격 관계대명사 that (what은 선행사를 포함하므로 불가).'],
    [G, 'She asked me ___ I would come to her party.', ['that', 'whether', 'what'], 1, 'yes/no 간접의문문은 whether(if)를 쓴다.'],
    [G, 'He suggested ___ a surprise party for her.', ['to throw', 'throwing', 'threw'], 1, 'suggest + 동명사(-ing)'],
  ],
  halloween: [
    [V, 'A ___ is a person who is believed to cast spells.', ['witch', 'wage', 'wick'], 0, 'witch: 마녀 / cast a spell: 주문을 걸다'],
    [V, 'The old house looked ___; no one dared to enter.', ['eerie', 'early', 'easy'], 0, 'eerie: 으스스한, 기이한'],
    [V, "To 'haunt' a house means that a ghost ___ it.", ['frequently visits', 'builds', 'paints'], 0, 'haunt: (유령이) 자주 출몰하다'],
    [G, 'She dressed up ___ a vampire for the party.', ['like', 'as', 'for'], 1, '~로서(분장·역할)는 as를 쓴다. like는 ~처럼.'],
    [G, 'I was so scared that I could hardly ___.', ['breathe', 'to breathe', 'breathing'], 0, 'could 뒤에는 동사원형: could hardly breathe'],
    [G, 'Not only ___ the house old, but it was also haunted.', ['was', 'is', 'did'], 0, 'Not only가 문두에 오면 도치: Not only was the house old'],
  ],
  alice: [
    [V, "'Curious' most nearly means ___.", ['eager to know', 'afraid', 'tired'], 0, 'curious: 호기심 많은'],
    [V, 'A ___ is a strange, dream-like imaginary world.', ['wonderland', 'wilderness', 'wasteland'], 0, 'wonderland: 이상한 나라 / wilderness: 황무지'],
    [V, "In British English, 'mad' in 'a mad tea party' means ___.", ['crazy', 'polite', 'quiet'], 0, 'mad: (영국식) 정신 나간, 엉뚱한'],
    [G, 'Alice was reading a book ___ she saw a white rabbit run by.', ['when', 'during', 'because'], 0, '진행 중인 동작 + when + 단발 사건'],
    [G, "The rabbit said, 'I am late.' → The rabbit said that he ___ late.", ['is', 'was', 'has been'], 1, '간접화법에서 시제 일치: am → was'],
    [G, 'Had Alice not followed the rabbit, she ___ Wonderland.', ["wouldn't have found", "wouldn't find", "hadn't found"], 0, "가정법 과거완료 도치: Had + 주어 + p.p., 주어 + would have p.p."],
  ],
  valentine: [
    [V, "The ___ of the gift made her cry; it showed how much he cared.", ['thoughtfulness', 'thoughtlessness', 'thoroughness'], 0, 'thoughtfulness: 배려심 / thoughtlessness: 무심함'],
    [V, 'A ___ is a small gift that shows love or friendship.', ['token', 'talent', 'tension'], 0, 'a token of love: 사랑의 징표'],
    [V, "They have been together for ten years; they are ___.", ['inseparable', 'invisible', 'incredible'], 0, 'inseparable: 떼려야 뗄 수 없는'],
    [G, 'She has loved him ___ they first met.', ['for', 'since', 'from'], 1, '시작 시점 앞에는 since, 기간 앞에는 for'],
    [G, 'It was Tom ___ gave her the roses.', ['who', 'whom', 'which'], 0, "강조구문 It was + 사람 + who: 주어를 강조"],
    [G, "I'd rather you ___ me the truth.", ['tell', 'told', 'will tell'], 1, "would rather + 주어 + 과거형: ~했으면 좋겠다(가정)"],
  ],
  palace: [
    [V, 'The prince ___ the throne after his father died.', ['inherited', 'invented', 'inhabited'], 0, 'inherit: 물려받다'],
    [V, 'A ___ is a formal ceremony in which a king or queen is crowned.', ['coronation', 'conversation', 'constitution'], 0, 'coronation: 대관식'],
    [V, "Which word is closest in meaning to 'magnificent'?", ['splendid', 'ordinary', 'tiny'], 0, 'magnificent ≈ splendid (웅장한, 훌륭한)'],
    [G, 'The palace, ___ was built in 1700, is open to visitors.', ['that', 'which', 'what'], 1, '쉼표 뒤 계속적 용법에는 that을 쓸 수 없고 which를 쓴다.'],
    [G, 'The princess is said ___ the most beautiful in the kingdom.', ['to be', 'being', 'to being'], 0, 'be said to + 동사원형: ~라고 한다'],
    [G, 'Never ___ such a grand ballroom.', ['I have seen', 'have I seen', 'I saw'], 1, '부정어(Never)가 문두에 오면 도치: have I seen'],
  ],
  christmas: [
    [V, 'We hung ___ on the tree: stars, balls and little bells.', ['ornaments', 'instruments', 'documents'], 0, 'ornament: 장식품'],
    [V, "'Anticipate' means to ___.", ['expect', 'forget', 'refuse'], 0, 'anticipate: 예상하다, 기대하다'],
    [V, 'A ___ is hung by the fireplace for Santa to fill with gifts.', ['stocking', 'stalking', 'stuffing'], 0, 'stocking: 크리스마스 양말 / stalk: 스토킹하다'],
    [G, "I'll send you a card ___ I get home.", ['as soon as', 'as long as', 'unless'], 0, '시간 부사절: as soon as (~하자마자), 미래도 현재시제로'],
    [G, 'If I ___ you, I would visit my family at Christmas.', ['am', 'were', 'will be'], 1, '가정법 과거: If I were you, I would ~'],
    [G, 'We spent the evening ___ carols.', ['sing', 'to sing', 'singing'], 2, 'spend + 시간 + (in) -ing'],
  ],
  winter: [
    [V, 'The lake was ___, so we could skate on it.', ['frozen', 'flooded', 'flowing'], 0, 'frozen: 얼어붙은'],
    [V, 'A heavy snowfall with strong winds is called a ___.', ['blizzard', 'breeze', 'drizzle'], 0, 'blizzard: 눈보라 / drizzle: 이슬비'],
    [V, "'Hibernate' means to ___ through the winter.", ['sleep', 'migrate', 'harvest'], 0, 'hibernate: 겨울잠을 자다 / migrate: 이동하다'],
    [G, 'It has been snowing ___ three days.', ['for', 'since', 'during'], 0, '기간(three days) 앞에는 for'],
    [G, 'The colder it gets, ___ I like staying inside.', ['the more', 'more', 'the most'], 0, 'the + 비교급, the + 비교급: ~할수록 더 ~하다'],
    [G, "You'd better ___ a coat; it's freezing.", ['wear', 'to wear', 'wearing'], 0, 'had better + 동사원형'],
  ],
}

export const BUILTIN_QUESTIONS: Question[] = Object.entries(BANK).flatMap(([place, rows]) =>
  rows.map(([type, q, choices, answer, explain], i) => ({ id: `${place}_${i + 1}`, type, q, choices, answer, explain, place })),
)

/* ---- 내가 만든 문제 (localStorage) ---- */
const KEY = 'ryuso.questions.v1'
const valid = (x: unknown): x is Question => {
  const q = x as Question
  return !!q && typeof q.id === 'string' && typeof q.q === 'string' && Array.isArray(q.choices) && q.choices.length >= 2 && q.choices.every((c) => typeof c === 'string') && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length && (q.type === 'vocab' || q.type === 'grammar')
}

function read(): Question[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter(valid).map((q) => ({ ...q, explain: typeof q.explain === 'string' ? q.explain : '', custom: true })) : []
  } catch {
    return []
  }
}

let custom = read()
let ver = 0
const subs = new Set<() => void>()
export const subscribeQuestions = (fn: () => void) => (subs.add(fn), () => void subs.delete(fn))
export const questionsVersion = () => ver
export const customQuestions = () => custom

function save(next: Question[]) {
  custom = next
  ver++
  if (!isRestoring()) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* 저장 공간이 없으면 이번 접속에서만 유지된다 */
    }
  }
  subs.forEach((fn) => fn())
}

export const addCustomQuestions = (list: Question[]) => save([...custom, ...list.map((q) => ({ ...q, custom: true }))])
export const removeCustomQuestion = (id: string) => save(custom.filter((q) => q.id !== id))

export const allQuestions = () => [...custom, ...BUILTIN_QUESTIONS]

/** 이 장소에서 낼 수 있는 문제 (장소 전용 + 어디서나 나오는 문제) */
export const questionsFor = (placeId: string, all: Question[] = allQuestions()) => all.filter((q) => !q.place || q.place === placeId)

/** 문제 하나 고르기: 최근에 푼 문제는 피한다 */
export function pickQuestion(placeId: string, recent: readonly string[] = [], rnd: () => number = Math.random, all: Question[] = allQuestions()): Question | null {
  const pool = questionsFor(placeId, all)
  const fresh = pool.filter((q) => !recent.includes(q.id))
  const from = fresh.length ? fresh : pool
  return from.length ? from[Math.floor(rnd() * from.length)] : null
}

/**
 * 한 줄에 한 문제: `유형 | 문제 | 보기1 / 보기2 / 보기3 | 정답번호 | 해설 | 장소(선택)`
 * 유형은 단어(vocab) 또는 문법(grammar). 정답번호는 1부터. 장소는 이름 또는 id (비우면 어디서나).
 */
export function parseQuestions(text: string, places: { id: string; ko: string }[], now = Date.now()): { ok: Question[]; errors: string[] } {
  const ok: Question[] = []
  const errors: string[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const cols = line.split('|').map((c) => c.trim())
    const bad = (why: string) => errors.push(`${i + 1}번째 줄: ${why}`)
    if (cols.length < 4) return bad('칸이 부족해요 (유형 | 문제 | 보기들 | 정답번호)')
    const t = cols[0].toLowerCase()
    const type: QType | null = /^(단어|vocab|v)$/.test(t) ? 'vocab' : /^(문법|grammar|g)$/.test(t) ? 'grammar' : null
    if (!type) return bad('유형은 단어 또는 문법이에요')
    const choices = cols[2].split('/').map((c) => c.trim()).filter(Boolean)
    if (choices.length < 2 || choices.length > 5) return bad('보기는 / 로 나눠서 2~5개')
    const n = Number(cols[3])
    if (!Number.isInteger(n) || n < 1 || n > choices.length) return bad(`정답번호는 1~${choices.length}`)
    if (!cols[1]) return bad('문제가 비었어요')
    const pl = cols[5] ? places.find((p) => p.id === cols[5] || p.ko === cols[5]) : undefined
    if (cols[5] && !pl) return bad(`장소를 찾지 못했어요: ${cols[5]}`)
    ok.push({ id: `custom_${now}_${i}`, type, q: cols[1], choices, answer: n - 1, explain: cols[4] ?? '', ...(pl ? { place: pl.id } : {}), custom: true })
  })
  return { ok, errors }
}
