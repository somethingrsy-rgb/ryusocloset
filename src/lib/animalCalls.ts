/**
 * 카페 동물 친구와 전화 놀이: 미리 써 둔 대화로 통화한다(인터넷·서버 없음).
 * 동물이 묻고 → 아이가 대답 버튼을 고르면 → 동물이 그 대답에 맞춰 말한다. 한 통화에 이야기 3개.
 * 대사 속 {name}·{me}·{food}·{did}·{go} 는 동물마다 다른 말로 바뀐다(말끝에 곰·냥 같은 소리는 붙이지 않고 보통 말투로).
 * {call}(유하야·유엘아)·{kid}(유하·유엘이) 는 지금 고른 아바타 이름으로 바뀐다.
 */
export interface CallReply { label: string; answer: string }
export interface CallTopic { ask: string; replies: CallReply[] }
export interface CallAnimal {
  name: string
  /** 통화 화면 동그라미 그림(public/cafe/call/<img>.webp) */
  img: string
  /** 전화번호(휴대폰 번호판으로 누른다) */
  phone: string
  /** "나 ○○야" 의 ○○야/○○이야 */
  me: string
  /** 목소리 높낮이·빠르기(음성 읽기) */
  pitch: number
  rate: number
  /** 좋아하는 음식(을/를까지) */
  food: string
  foodName: string
  /** 오늘 한 일, ~하러 가다 */
  did: string
  go: string
  topics: CallTopic[]
}

const t = (ask: string, ...replies: [string, string][]): CallTopic => ({ ask, replies: replies.map(([label, answer]) => ({ label, answer })) })

/** 카페 자리 순서(곰·토끼·고양이·강아지·병아리·오리·다람쥐·판다)와 같다 */
export const CALL_ANIMALS: CallAnimal[] = [
  {
    name: '곰이', img: 'bear', phone: '4467', me: '곰이야', pitch: 0.8, rate: 0.9, food: '꿀을', foodName: '꿀', did: '낮잠을 잤어', go: '낮잠 자러',
    topics: [
      t('숲에서 벌집을 찾았는데 꿀이 가득했어! 너도 한 숟가락 줄까?', ['응, 줘!', '자, 아~ 해! 달콤하지?'], ['벌 무서워!', '걱정 마. 벌들은 내 친구야.'], ['같이 나눠 먹자', '좋아! 나눠 먹으면 더 맛있어.']),
      t('나 겨울잠 자는 연습 중이야. 몇 밤 자면 봄이 올까?', ['백 밤!', '백 밤이나? 이불을 더 가져와야겠다!'], ['세 밤!', '세 밤이면 금방이다!'], ['자지 말고 놀자', '그래! 잠은 나중에 자고 놀자!']),
    ],
  },
  {
    name: '몽실', img: 'bunny', phone: '1987', me: '몽실이야', pitch: 1.3, rate: 1.05, food: '당근을', foodName: '당근', did: '깡충깡충 뛰었어', go: '깡충깡충 뛰러',
    topics: [
      t('내 귀 길지? 무슨 소리든 다 들려! 지금 무슨 소리 내 볼래?', ['야옹~', '어? 냥이가 온 줄 알았어!'], ['짝짝짝!', '박수 소리다! 고마워!'], ['쉿, 조용히', '쉿... 바람 소리가 들린다.']),
      t('깡총깡총 몇 번 뛰어 볼까?', ['열 번!', '하나, 둘, 셋... 열! 헥헥, 다 뛰었어!'], ['한 번만', '깡총! 한 번 뛰었다!'], ['같이 뛰자', '좋아! 하나 둘 셋, 깡총깡총!']),
    ],
  },
  {
    name: '냥이', img: 'cat', phone: '3082', me: '냥이야', pitch: 1.25, rate: 1, food: '생선을', foodName: '생선', did: '털실을 굴렸어', go: '털실 굴리러',
    topics: [
      t('나 지금 햇볕에서 식빵 굽는 중이야. 식빵 굽는 게 뭔지 알아?', ['빵 굽는 거지!', '히히, 아니야. 동그랗게 웅크리고 앉는 거야!'], ['몰라!', '고양이가 동그랗게 앉아 있는 걸 식빵 굽는다고 해!'], ['나도 해 볼래', '너도 동그랗게! 따뜻하지?']),
      t('털실 공을 굴렸는데 어디로 갔는지 모르겠어. 같이 찾아 줄래?', ['소파 밑에 있어!', '와, 찾았다! 고마워!'], ['내가 찾아볼게', '역시 최고야! 꼭 찾아 줘.'], ['새 거 사자', '좋아! 분홍색 털실로 사자!']),
    ],
  },
  {
    name: '멍멍', img: 'dog', phone: '0255', me: '멍멍이야', pitch: 1.1, rate: 1.1, food: '뼈다귀 쿠키를', foodName: '뼈다귀 쿠키', did: '공놀이를 했어', go: '공놀이 하러',
    topics: [
      t('공 던지기 할래? 내가 다 물어 올게!', ['멀리 던질게!', '후다닥! 물어 왔다! 또 던져 줘!'], ['살살 던질게', '톡! 잡았다! 꼬리가 막 흔들려!'], ['공 어디 있지?', '내 집 앞에 있어! 내가 가져갈게.']),
      t('산책할 때 냄새 맡는 게 제일 재밌어. 오늘은 무슨 냄새가 날까?', ['꽃 냄새!', '킁킁, 달콤한 꽃 냄새가 난다!'], ['빵 냄새!', '킁킁, 카페에서 빵 굽는 냄새다!'], ['방귀 냄새!', '으악! 누구야? 히히!']),
    ],
  },
  {
    name: '삐약', img: 'chick', phone: '9211', me: '삐약이야', pitch: 1.4, rate: 1.1, food: '좁쌀을', foodName: '좁쌀', did: '노래를 불렀어', go: '노래 부르러',
    topics: [
      t('나 노래 연습했어! 들어 볼래?', ['응, 불러 줘!', '삐약삐약 삐약삐약~ 어때?'], ['같이 부르자', '좋아! 삐약삐약~ 너도 해 봐!'], ['작게 불러 줘', '삐약... 삐약... 작게 불렀어. 히히.']),
      t('나는 아직 작아서 빨리 크고 싶어. 어떻게 하면 클까?', ['밥 잘 먹기!', '좁쌀을 많이 먹어야겠다!'], ['푹 자기!', '오늘은 일찍 잘게!'], ['지금도 귀여워', '헤헤, 고마워! 기분 좋다.']),
    ],
  },
  {
    name: '꽥꽥', img: 'duck', phone: '9072', me: '꽥꽥이야', pitch: 1.15, rate: 1.05, food: '빵 부스러기를', foodName: '빵 부스러기', did: '수영을 했어', go: '수영하러',
    topics: [
      t('연못에서 수영하다가 개구리를 만났어! 개구리 소리 낼 줄 알아?', ['개굴개굴!', '와, 똑같다! 개구리가 대답할지도 몰라.'], ['몰라~', '개굴개굴 하는 거야. 같이 해 보자!'], ['꽥꽥이 더 좋아', '꽥꽥! 고마워!']),
      t('비 오는 날 웅덩이에서 첨벙첨벙 노는 거 좋아해?', ['완전 좋아!', '다음에 비 오면 같이 첨벙첨벙 하자!'], ['옷 젖어서 싫어', '그럼 우비 입고 놀자!'], ['해 봤어!', '역시! 첨벙 대장이구나!']),
    ],
  },
  {
    name: '다람', img: 'squirrel', phone: '8931', me: '다람이야', pitch: 1.35, rate: 1.1, food: '도토리를', foodName: '도토리', did: '나무를 탔어', go: '나무 타러',
    topics: [
      t('도토리를 볼에 몇 개 넣을 수 있는지 셀 거야! 같이 세어 줄래?', ['하나, 둘, 셋!', '우물우물... 세 개 들어갔다!'], ['다섯 개!', '다섯 개나! 볼이 빵빵해!'], ['그만 먹어~', '헤헤, 알았어. 나머지는 숨겨 둘게.']),
      t('도토리를 숨겼는데 어디 숨겼는지 까먹었어. 어디일까?', ['나무 밑!', '맞다! 나무 밑에 있었어!'], ['땅속!', '파 보니 정말 있다! 고마워!'], ['내 주머니에?', '어? 히히, 장난치지 마!']),
    ],
  },
  {
    name: '판다', img: 'panda', phone: '7259', me: '판다야', pitch: 0.9, rate: 0.92, food: '대나무를', foodName: '대나무', did: '데굴데굴 굴렀어', go: '데굴데굴 구르러',
    topics: [
      t('대나무 냠냠 먹는 중이야. 너도 한 입 먹어 볼래?', ['냠냠, 맛있다!', '그치? 아삭아삭 맛있지!'], ['딱딱해!', '히히, 판다 이빨은 튼튼해서 괜찮아.'], ['케이크가 더 좋아', '그럼 카페에서 대나무 케이크 만들어 줘!']),
      t('나는 데굴데굴 구르는 게 제일 좋아. 같이 굴러 볼래?', ['데굴데굴~', '데굴데굴~ 어지러워! 히히!'], ['어지러워!', '그럼 천천히 굴러 보자.'], ['구경할래', '그럼 박수 쳐 줘!']),
    ],
  },
]

/** 모든 동물이 함께 쓰는 이야기 */
export const SHARED_TOPICS: CallTopic[] = [
  t('오늘 뭐 하고 놀았어?', ['밖에서 뛰어놀았어!', '우와, 신났겠다! 나는 오늘 {did}.'], ['그림 그렸어!', '멋지다! 다음에 나도 그려 줄래?'], ['비밀이야~', '히히, 궁금하다! 나중에 꼭 알려 줘.']),
  t('나는 {food} 제일 좋아해. 너는 뭐 좋아해?', ['딸기 케이크!', '딸기 케이크! 카페에서 같이 먹자!'], ['아이스크림!', '차갑고 달콤한 아이스크림, 나도 좋아!'], ['나도 {foodName}!', '정말? 우리 입맛이 똑같다!']),
  t('오늘 날씨는 어때?', ['해님이 쨍쨍!', '그럼 산책 가기 딱 좋겠다!'], ['비가 와', '그럼 장화 신고 첨벙첨벙 하자!'], ['구름이 많아', '구름이 뭐처럼 생겼는지 같이 찾아보자!']),
  t('우리 같이 노래 부를래?', ['좋아! 랄랄라~', '랄랄라~ 너 노래 진짜 잘한다!'], ['부끄러워...', '괜찮아. 내가 먼저 부를게. 랄랄라~'], ['다음에!', '알았어. 다음에 꼭 같이 부르자!']),
  t('오늘 기분은 어때?', ['최고야!', '나도 너랑 통화해서 기분 최고야!'], ['조금 슬퍼', '토닥토닥. 내가 꼬옥 안아 줄게.'], ['졸려~', '하암~ 나도 졸리다. 이따 같이 코 자자.']),
]

export const HELLOS = [
  '여보세요? 나 {me}! {call}, 안녕? 전화 줘서 고마워!',
  '여보세요~? 앗, {kid}구나! {call}, 안녕? 목소리 들으니까 너무 좋다!',
  '네, {name}입니다~ 히히, {kid}구나! {call}, 반가워!',
]
export const BYES = [
  '{call}, 오늘 통화 정말 재밌었어! 또 전화해 줘. 안녕~',
  '이제 {go} 갈게. {call}, 다음에 또 이야기하자! 안녕~',
  '{call}, 전화해 줘서 고마워. 카페에서 또 만나자! 안녕~',
]

/** 받침이 있는 이름인지(유엘 → 있음, 유하 → 없음) */
const hasBatchim = (word: string) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  return c >= 0 && c <= 11171 && c % 28 !== 0
}
/** 아이 이름 부르는 말: {call} = 유하야·유엘아, {kid} = 유하·유엘이(…구나 앞). 이름이 없으면 친구야·너 */
export const kidWords = (name?: string) => name
  ? { call: name + (hasBatchim(name) ? '아' : '야'), kid: name + (hasBatchim(name) ? '이' : '') }
  : { call: '친구야', kid: '너' }

/** 대사의 {…} 를 동물에 맞게 바꾼다 */
export const fillLine = (text: string, a: CallAnimal, kidName?: string) => {
  const w = kidWords(kidName)
  return text.replace(/\{(name|me|food|foodName|did|go|call|kid)\}/g, (_, k: string) => (k === 'call' || k === 'kid' ? w[k] : String(a[k as keyof CallAnimal])))
}

/** 녹음 파일 이름: 동물·대사가 같으면 늘 같은 이름(대사를 고치면 새 이름이 되어 다시 녹음한다) */
export const lineId = (animal: number, text: string) => {
  let h = 2166136261
  for (const ch of `${animal}:${text}`) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}
/** 녹음해야 하는 대사 전부(아이 이름은 아바타 이름마다): 동물별로 겹치지 않게 */
export function allCallLines(kidNames: string[]): { animal: number; id: string; text: string }[] {
  const out = new Map<string, { animal: number; id: string; text: string }>()
  CALL_ANIMALS.forEach((a, animal) => {
    const add = (text: string) => { const id = lineId(animal, text); out.set(`${animal}/${id}`, { animal, id, text }) }
    for (const kid of kidNames) for (const line of [...HELLOS, ...BYES]) add(fillLine(line, a, kid))
    for (const tp of [...a.topics, ...SHARED_TOPICS]) { add(fillLine(tp.ask, a)); tp.replies.forEach((r) => add(fillLine(r.answer, a))) }
  })
  return [...out.values()]
}

/** 번호판으로 누른 번호의 동물(없는 번호면 -1) */
export const animalByPhone = (digits: string) => CALL_ANIMALS.findIndex((a) => a.phone === digits)

export interface CallPlan { hello: string; topics: CallTopic[]; bye: string }
/** 한 통화: 인사 → 이야기 3개(이 동물만의 이야기 1개는 꼭) → 끝인사. 대사는 이미 바꿔 둔다 */
export function planCall(animal: number, rnd: () => number = Math.random, kidName?: string): CallPlan {
  const a = CALL_ANIMALS[animal]
  const pickFrom = <T,>(list: T[]) => list.splice(Math.floor(rnd() * list.length), 1)[0]
  const own = [...a.topics]
  const first = pickFrom(own)
  const rest = [...own, ...SHARED_TOPICS]
  const chosen = [first, pickFrom(rest), pickFrom(rest)]
  // 동물만의 이야기가 늘 맨 앞이면 뻔하니 순서를 섞는다
  for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [chosen[i], chosen[j]] = [chosen[j], chosen[i]] }
  const fill = (text: string) => fillLine(text, a, kidName)
  const fillTopic = (tp: CallTopic): CallTopic => ({ ask: fill(tp.ask), replies: tp.replies.map((r) => ({ label: fill(r.label), answer: fill(r.answer) })) })
  return { hello: fill(pickFrom([...HELLOS])), topics: chosen.map(fillTopic), bye: fill(pickFrom([...BYES])) }
}
