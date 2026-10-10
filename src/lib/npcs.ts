import type { Lang } from '../i18n'

/** 장소마다 NPC 한 명과 이벤트 하나: quiz(퀴즈) / rps(가위바위보) / gift(선물 상자) */
export type EventKind = 'quiz' | 'rps' | 'gift'

type L = Record<Lang, string>

export interface Quiz {
  q: L
  /** 보기와 정답 번호 */
  choices: L[]
  answer: number
}

export interface Npc {
  emoji: string
  name: L
  /** 말 걸 때 하는 말 (돌아가며) */
  lines: L[]
  event: EventKind
  quiz?: Quiz
  /** 이벤트를 알리는 한마디 */
  pitch: L
}

const l = (ko: string, en: string): L => ({ ko, en })

export const NPCS: Record<string, Npc> = {
  spring: {
    emoji: '🐰', name: l('토끼 소풍지기', 'Picnic Bunny'),
    lines: [l('벚꽃이 한창이야! 도시락 먹고 갈래?', 'The blossoms are in full bloom!'), l('나무 사이를 잘 봐, 반짝이는 게 있을 거야.', 'Look between the trees for sparkles.')],
    event: 'quiz', pitch: l('퀴즈를 맞히면 선물을 줄게!', 'Answer my quiz for a gift!'),
    quiz: { q: l('봄에 피는 분홍색 꽃은?', 'Which pink flower blooms in spring?'), choices: [l('벚꽃', 'Cherry blossom'), l('해바라기', 'Sunflower'), l('국화', 'Chrysanthemum')], answer: 0 },
  },
  summer: {
    emoji: '🦀', name: l('게 구조대원', 'Lifeguard Crab'),
    lines: [l('바다는 오늘도 반짝반짝!', 'The sea is sparkling today!'), l('모래사장 쪽에서 뭔가 빛났어.', 'Something shone on the sand.')],
    event: 'rps', pitch: l('가위바위보에서 이기면 선물을 줄게!', 'Beat me at rock-paper-scissors for a gift!'),
  },
  camp: {
    emoji: '🦊', name: l('여우 캠프지기', 'Camp Fox'),
    lines: [l('모닥불 옆은 따뜻해~', 'It is warm by the campfire~'), l('텐트 뒤쪽도 살펴봐!', 'Check behind the tent too!')],
    event: 'gift', pitch: l('캠핑장에 선물 상자를 숨겨 뒀어!', 'I hid a gift box at the campsite!'),
  },
  birthday: {
    emoji: '🐻', name: l('곰 파티 요정', 'Party Bear'),
    lines: [l('생일 축하해! 케이크 먹자!', 'Happy birthday! Cake time!'), l('풍선 사이에 숨은 게 있어.', 'Something hides among the balloons.')],
    event: 'rps', pitch: l('나랑 가위바위보 한판?', 'A round of rock-paper-scissors?'),
  },
  halloween: {
    emoji: '🦇', name: l('박쥐 집사', 'Butler Bat'),
    lines: [l('으스스하지만 무서워하지 마.', 'Spooky, but do not be afraid.'), l('호박 근처가 수상해…', 'Something is odd near the pumpkins...')],
    event: 'quiz', pitch: l('수수께끼를 풀면 보물을 줄게.', 'Solve my riddle for a treasure.'),
    quiz: { q: l('핼러윈에 꼭 만드는 주황색 채소는?', 'Which orange vegetable do we carve at Halloween?'), choices: [l('당근', 'Carrot'), l('호박', 'Pumpkin'), l('귤', 'Tangerine')], answer: 1 },
  },
  alice: {
    emoji: '🐇', name: l('흰 토끼', 'White Rabbit'),
    lines: [l('늦었어, 늦었어! 티파티에 늦겠어!', 'I am late, I am late!'), l('찻잔 속도 들여다봐.', 'Peek into the teacups.')],
    event: 'quiz', pitch: l('내 질문에 답하면 선물을 줄게.', 'Answer my question and get a gift.'),
    quiz: { q: l('앨리스가 따라간 동물은?', 'Which animal did Alice follow?'), choices: [l('흰 토끼', 'White rabbit'), l('고양이', 'Cat'), l('여우', 'Fox')], answer: 0 },
  },
  valentine: {
    emoji: '💌', name: l('우체부 큐피드', 'Cupid Postman'),
    lines: [l('마음을 전하는 날이야~', 'A day to share your feelings~'), l('하트 모양을 따라가 봐!', 'Follow the hearts!')],
    event: 'gift', pitch: l('너에게 온 편지와 선물이 있어!', 'There is a letter and gift for you!'),
  },
  palace: {
    emoji: '🫅', name: l('궁전 시종', 'Palace Attendant'),
    lines: [l('어서 오십시오, 공주님.', 'Welcome, Your Highness.'), l('샹들리에 아래를 확인해 보세요.', 'Look beneath the chandelier.')],
    event: 'rps', pitch: l('가위바위보로 승부를 겨뤄 보시겠습니까?', 'Care for a game of rock-paper-scissors?'),
  },
  christmas: {
    emoji: '🎅', name: l('산타', 'Santa'),
    lines: [l('호호호! 메리 크리스마스!', 'Ho ho ho! Merry Christmas!'), l('트리 뒤에 선물이 있을지도?', 'Maybe a gift behind the tree?')],
    event: 'gift', pitch: l('착한 아이에게 선물을 놓고 갔단다.', 'I left a gift for a good child.'),
  },
  winter: {
    emoji: '⛄', name: l('눈사람', 'Snowman'),
    lines: [l('추워도 괜찮아, 난 눈사람이니까!', 'I do not mind the cold!'), l('눈 속에 반짝이는 게 있어.', 'Something sparkles in the snow.')],
    event: 'quiz', pitch: l('퀴즈를 맞히면 선물을 줄게!', 'Answer my quiz for a gift!'),
    quiz: { q: l('눈의 결정은 몇 각형일까?', 'How many sides does a snowflake have?'), choices: [l('4각형', '4'), l('6각형', '6'), l('8각형', '8')], answer: 1 },
  },
}

export type Rps = 'rock' | 'paper' | 'scissors'
export const RPS_ICON: Record<Rps, string> = { rock: '✊', paper: '🖐️', scissors: '✌️' }
const BEATS: Record<Rps, Rps> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }
/** 내가 이기면 'win', 비기면 'draw' */
export const rpsResult = (me: Rps, npc: Rps): 'win' | 'lose' | 'draw' => (me === npc ? 'draw' : BEATS[me] === npc ? 'win' : 'lose')
