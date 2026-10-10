/**
 * 영어 회화 연습 (초급): NPC 가 영어로 말하면 보기 중 알맞은 대답을 고르며 대화를 이어간다.
 * 각 차례(turn)에는 정답(ok) 보기가 정확히 하나 있고, 틀린 보기에는 왜 어색한지 설명(tip)이 붙는다.
 */
export type ConvoKind = 'daily' | 'business'

export interface Option {
  text: string
  ok?: boolean
  /** 한국어 설명: 정답이면 왜 좋은지, 오답이면 왜 어색한지 */
  tip: string
}

export interface Turn {
  /** NPC 의 영어 대사와 한국어 번역 */
  npc: string
  ko: string
  options: Option[]
}

export interface Scenario {
  id: string
  kind: ConvoKind
  emoji: string
  /** NPC 이름과 상황 설명 (한국어) */
  npcName: string
  title: string
  turns: Turn[]
}

const o = (text: string, tip: string, ok = false): Option => (ok ? { text, tip, ok } : { text, tip })

export const SCENARIOS: Scenario[] = [
  {
    id: 'daily_neighbor', kind: 'daily', emoji: '👩', npcName: 'Emma', title: '새 이웃과 인사',
    turns: [
      { npc: "Hi! I just moved in next door. I'm Emma.", ko: '안녕하세요! 옆집에 막 이사 왔어요. 저는 Emma예요.', options: [
        o("Nice to meet you, Emma. I'm Jin.", '처음 만났을 때 쓰는 대표 인사 "Nice to meet you."', true),
        o('Good night, Emma.', '"Good night"은 밤에 헤어질 때 하는 인사예요.'),
        o('I am fine, thank you.', '"어떻게 지내세요?"에 하는 대답이라 지금 상황과 맞지 않아요.'),
      ] },
      { npc: 'Do you live around here?', ko: '이 근처에 사세요?', options: [
        o('Yes, I live in the building across the street.', '질문(사는 곳)에 맞게 위치까지 알려줬어요.', true),
        o('Yes, I have a dog.', '사는 곳을 물었는데 반려견 이야기를 해서 엇나갔어요.'),
        o('No, thank you.', '"No, thank you"는 권유를 거절할 때 써요.'),
      ] },
      { npc: 'Is there a good café near here?', ko: '근처에 괜찮은 카페 있나요?', options: [
        o("Yes, there's a nice one on the corner.", '"there is ~"로 있다고 말하고 위치(on the corner)를 알려줬어요.', true),
        o("It's five dollars.", '가격을 말했어요. 질문은 카페가 있는지였어요.'),
        o('Yes, I like to coffee.', '"like to coffee"는 틀린 표현이에요. like coffee 또는 like drinking coffee.'),
      ] },
    ],
  },
  {
    id: 'daily_weather', kind: 'daily', emoji: '🧔', npcName: 'Tom', title: '날씨와 주말 이야기',
    turns: [
      { npc: "Beautiful day, isn't it?", ko: '날씨 좋죠, 그렇지 않나요?', options: [
        o("Yes, it's really sunny today.", '맞장구(Yes) + 날씨를 이어서 말한 자연스러운 대답이에요.', true),
        o("No, I don't have it.", '"have it"은 이 상황에서 의미가 통하지 않아요.'),
        o("I'm twenty-five.", '나이를 말해서 질문과 상관없는 대답이에요.'),
      ] },
      { npc: 'Do you have any plans for the weekend?', ko: '주말에 계획 있어요?', options: [
        o("Yes, I'm going to meet my friends.", '"be going to"는 미리 정한 계획을 말할 때 써요.', true),
        o('Yes, I went to the park yesterday.', '과거형이라 주말 계획(미래)과 맞지 않아요.'),
        o('It is Saturday.', '요일을 말해서 질문(계획)에 대답하지 못했어요.'),
      ] },
      { npc: 'That sounds fun! What time are you meeting?', ko: '재밌겠다! 몇 시에 만나요?', options: [
        o('At around three o\'clock.', '시각 앞에는 at, "around"는 대략을 뜻해요.', true),
        o('For three hours.', '"for"는 기간 앞에 써요. 시각을 물었어요.'),
        o('In Seoul.', '장소를 말했어요. 시간을 물었어요.'),
      ] },
    ],
  },
  {
    id: 'daily_directions', kind: 'daily', emoji: '🧑', npcName: 'Sam', title: '길 묻기',
    turns: [
      { npc: 'Hi, can I help you?', ko: '안녕하세요, 도와드릴까요?', options: [
        o('Yes, excuse me. How do I get to the station?', '"Excuse me"로 말을 걸고 "How do I get to ~?"로 길을 물었어요.', true),
        o('Yes, I am the station.', '"나는 역이다"라는 뜻이 되어 버려요.'),
        o('No, I help you.', '"내가 당신을 돕는다"는 뜻이라 상황과 반대예요.'),
      ] },
      { npc: "Go straight for two blocks, then turn left.", ko: '두 블록 직진한 다음 좌회전하세요.', options: [
        o('Two blocks, then left. Got it, thanks!', '들은 내용을 짧게 확인하고 감사 인사까지 했어요.', true),
        o('Two blocks, then right.', 'left(왼쪽)를 right(오른쪽)로 잘못 따라 했어요.'),
        o('I turn the station.', '문장의 뜻이 통하지 않아요.'),
      ] },
      { npc: "It's about a five-minute walk.", ko: '걸어서 5분쯤 걸려요.', options: [
        o("Great, that's close. Thank you so much!", '거리가 가깝다는 반응과 감사 표현이 자연스러워요.', true),
        o("Great, it's five dollars.", '거리 이야기에 가격을 말해서 어색해요.'),
        o('Great, I am five minutes old.', '"5분 된 아기"라는 뜻이 되어 버려요.'),
      ] },
    ],
  },
  {
    id: 'daily_sorry', kind: 'daily', emoji: '🧑‍🎓', npcName: 'Lily', title: '사과하고 감사하기',
    turns: [
      { npc: 'Oh, sorry! I bumped into you.', ko: '아, 죄송해요! 부딪혔네요.', options: [
        o('No problem. Are you okay?', '"No problem"으로 괜찮다고 하고 상대를 걱정해 줬어요.', true),
        o("You're welcome.", '"You\'re welcome"은 고맙다는 말에 대한 대답이에요.'),
        o('Yes, please.', '권유에 대한 대답이라 이 상황과 맞지 않아요.'),
      ] },
      { npc: "I'm fine, thanks. Is this your phone? It's on the floor.", ko: '전 괜찮아요. 이거 당신 폰이에요? 바닥에 있어요.', options: [
        o("Oh yes, it's mine. Thank you so much!", '내 것은 mine. 주워준 것에 감사까지 했어요.', true),
        o("Oh yes, it's yours. Thank you so much!", '내 폰이니까 yours(당신 것)가 아니라 mine이에요.'),
        o("Oh no, I'm sorry.", '폰이 맞는지 대답하지 않고 사과만 했어요.'),
      ] },
      { npc: 'No worries! Have a nice day.', ko: '별말씀을요! 좋은 하루 보내세요.', options: [
        o('You too! Take care.', '"You too"는 같은 인사를 돌려줄 때 쓰는 표현이에요.', true),
        o('Nice to meet you.', '처음 만날 때 하는 인사라 헤어질 때 어색해요.'),
        o('Good morning!', '헤어질 때는 아침 인사가 맞지 않아요.'),
      ] },
    ],
  },
  {
    id: 'biz_intro', kind: 'business', emoji: '👩‍💼', npcName: 'Grace (팀장)', title: '팀에서 자기소개',
    turns: [
      { npc: 'Welcome to the team! Could you introduce yourself?', ko: '팀에 오신 걸 환영해요! 자기소개 해주시겠어요?', options: [
        o("Sure. I'm Jin, and I'll be working on the marketing team.", '이름과 소속을 간단히 소개했어요. "work on the team"은 팀에서 일한다는 뜻.', true),
        o('Sure. I am marketing.', '"나는 마케팅이다"라는 뜻이 되어 버려요.'),
        o('Sure. Where are you from?', '자기소개 대신 되묻기만 해서 요청에 답하지 못했어요.'),
      ] },
      { npc: 'Great. What will you be working on?', ko: '좋아요. 어떤 일을 맡게 되나요?', options: [
        o("I'll be in charge of social media campaigns.", '"be in charge of ~"는 ~을 맡고 있다는 비즈니스 표현이에요.', true),
        o('I was in charge of social media yesterday.', '과거형이라 앞으로 맡을 일을 묻는 질문과 맞지 않아요.'),
        o('I charge social media for free.', '"charge"는 요금을 받는다는 뜻이라 엉뚱한 말이 돼요.'),
      ] },
      { npc: 'Excellent. Let me know if you need anything.', ko: '좋네요. 필요한 게 있으면 알려주세요.', options: [
        o("Thank you. I'll ask if I have any questions.", '감사하고 앞으로 질문하겠다고 공손하게 답했어요.', true),
        o('Thank you. I will question you.', '"I will question you"는 "당신을 심문하겠다"처럼 들려요.'),
        o("No. I don't need anything. Goodbye.", '너무 퉁명스럽고 갑작스럽게 대화를 끊었어요.'),
      ] },
    ],
  },
  {
    id: 'biz_help', kind: 'business', emoji: '🧑‍💻', npcName: 'Ben (동료)', title: '동료에게 도움 요청',
    turns: [
      { npc: "Hey, you look busy. What's up?", ko: '바빠 보이네요. 무슨 일이에요?', options: [
        o("I'm having trouble with this report. Could you help me?", '"have trouble with ~"와 "Could you ~?"로 공손하게 부탁했어요.', true),
        o("I'm having a trouble with this report. Can you help?", '"trouble"은 셀 수 없는 명사라 a를 붙이지 않아요.'),
        o('I have troubled this report.', '"troubled"는 이 문맥에서 뜻이 통하지 않아요.'),
      ] },
      { npc: 'Sure. Which part is difficult?', ko: '물론이죠. 어느 부분이 어려워요?', options: [
        o("I don't understand how to make this chart.", '"how to + 동사원형"으로 어려운 부분을 정확히 말했어요.', true),
        o("I don't understand how to made this chart.", '"how to" 뒤에는 동사원형(make)이 와요.'),
        o('I understand this chart very difficult.', '"difficult"는 이해하는 사람이 아니라 대상을 설명하는 말이에요.'),
      ] },
      { npc: "Oh, I see. Just click here and choose 'Insert'.", ko: "아, 알겠어요. 여기를 클릭하고 'Insert'를 선택하세요.", options: [
        o('That worked! Thanks a lot for your help.', '"worked"로 해결됐다고 알리고 도움에 감사했어요.', true),
        o('That worked! Thanks a lot for your hurt.', '"hurt"는 다치게 한다는 뜻이에요. 도움은 help.'),
        o("I clicked. You're welcome.", '"You\'re welcome"은 감사 인사에 대한 대답이지, 내가 먼저 할 말이 아니에요.'),
      ] },
    ],
  },
  {
    id: 'biz_schedule', kind: 'business', emoji: '👩‍🏫', npcName: 'Clara (거래처)', title: '회의 일정 잡기',
    turns: [
      { npc: 'Hi, do you have time to talk about the project this week?', ko: '이번 주에 프로젝트 얘기할 시간 있어요?', options: [
        o('Yes, how about Wednesday afternoon?', '"How about ~?"으로 구체적인 일정을 제안했어요.', true),
        o('Yes, I was Wednesday afternoon.', '"I was Wednesday afternoon"은 문장이 되지 않아요.'),
        o('Yes, the project is difficult.', '시간이 있는지 묻는 질문에 일정을 제안하지 않았어요.'),
      ] },
      { npc: 'Wednesday is busy for me. Is Thursday okay?', ko: '수요일은 바빠요. 목요일 괜찮아요?', options: [
        o('Thursday works for me. What time?', '"works for me"는 일정이 나한테 괜찮다는 표현이에요.', true),
        o('Thursday works to me.', '"work for me"가 맞아요. to는 쓰지 않아요.'),
        o('Thursday was working yesterday.', '과거 진행형이라 일정을 정하는 상황과 맞지 않아요.'),
      ] },
      { npc: 'How about 10 a.m.?', ko: '오전 10시 어때요?', options: [
        o("10 a.m. is fine. I'll send a calendar invite.", '동의하고 다음 할 일(초대장)을 말했어요. will 뒤에는 동사원형.', true),
        o("10 a.m. is fine. I'll sent a calendar invite.", '"will" 뒤에는 동사원형(send)이 와요.'),
        o('10 a.m. is fine. I send a calendar invite yesterday.', '"yesterday"는 과거라서 앞으로 보낼 일에 맞지 않아요.'),
      ] },
    ],
  },
  {
    id: 'biz_late', kind: 'business', emoji: '👨‍💼', npcName: 'David (상사)', title: '늦을 때 전화하기',
    turns: [
      { npc: 'Hello, this is David. Where are you? The meeting is about to start.', ko: 'David입니다. 어디예요? 회의가 곧 시작해요.', options: [
        o("I'm so sorry. I'm stuck in traffic.", '먼저 사과하고 "be stuck in traffic(차가 막혀서 꼼짝 못 한다)"로 이유를 말했어요.', true),
        o('I stuck in traffic.', '"be stuck"이라서 am이 필요해요: I\'m stuck in traffic.'),
        o("I'm so happy. I'm in traffic.", '지각 상황에서 "happy"는 어울리지 않아요.'),
      ] },
      { npc: 'How late will you be?', ko: '얼마나 늦을 것 같아요?', options: [
        o("I think I'll be there in about 15 minutes.", '"in + 시간"은 지금부터 그만큼 뒤에라는 뜻이에요.', true),
        o('I think I was there in about 15 minutes.', '과거형 was는 앞으로 도착할 시간을 말하는 데 맞지 않아요.'),
        o("I think I'll be there for about 15 minutes ago.", '"for"와 "ago"를 같이 쓸 수 없고 뜻도 안 맞아요.'),
      ] },
      { npc: "Okay. We'll start without you, so please join when you arrive.", ko: '알겠어요. 먼저 시작할 테니 도착하면 합류하세요.', options: [
        o('Thank you for understanding. See you soon.', '"Thank you for + -ing"로 이해해 줘서 고맙다고 공손하게 말했어요.', true),
        o('Thank you for understand. See you soon.', '"for" 뒤에는 동명사(understanding)가 와요.'),
        o("That's not fair. I'm coming.", '지각한 쪽이 불평하면 공손하지 않아요.'),
      ] },
    ],
  },
  {
    id: 'daily_cafe', kind: 'daily', emoji: '🧑‍🍳', npcName: 'Barista', title: '카페에서 주문하기',
    turns: [
      { npc: 'Hi! What can I get for you?', ko: '안녕하세요! 무엇을 드릴까요?', options: [
        o('Can I have a latte, please?', '주문할 때는 "Can I have ~, please?"가 가장 자연스러워요.', true),
        o('I have a latte.', '"나는 라떼를 갖고 있다"라는 뜻이라 주문이 되지 않아요.'),
        o('Give me latte.', '명령하는 말투라 무례하고, a도 빠졌어요.'),
      ] },
      { npc: 'For here or to go?', ko: '드시고 가세요, 가져가세요?', options: [
        o('To go, please.', '"To go"는 포장이라는 뜻이에요.', true),
        o('Yes, please.', '"A or B?" 질문에는 Yes/No로 대답할 수 없어요.'),
        o("It's cold today.", '질문과 상관없는 말이에요.'),
      ] },
      { npc: "That's four fifty. Cash or card?", ko: '4달러 50센트예요. 현금이세요, 카드세요?', options: [
        o('Card, please. Here you go.', '"Here you go"는 물건이나 카드를 건넬 때 쓰는 표현이에요.', true),
        o('Card is expensive.', '"카드는 비싸다"라는 뜻이 되어 버려요.'),
        o('I am card.', '"나는 카드다"라는 뜻이 되어 버려요.'),
      ] },
    ],
  },
  {
    id: 'daily_plan', kind: 'daily', emoji: '👩', npcName: 'Mina', title: '약속 시간 바꾸기',
    turns: [
      { npc: 'Hey, are we still meeting at 6 tonight?', ko: '저기, 오늘 6시에 만나는 거 맞지?', options: [
        o('Sorry, something came up. Can we meet at 7 instead?', '"something came up(일이 생겼다)"과 "instead(대신)"는 일정을 바꿀 때 자주 써요.', true),
        o('Sorry, I came up something. Can we meet 7?', '"something came up"이 정해진 표현이고, 시각 앞에는 at이 필요해요.'),
        o("No, I'm 6 tonight.", '문장의 뜻이 통하지 않아요.'),
      ] },
      { npc: 'Sure, no problem. Where should we meet?', ko: '괜찮아. 어디서 만날까?', options: [
        o('How about the café near the station?', '"How about ~?"으로 장소를 제안했어요.', true),
        o('Where about the café near station.', '"How about + the + 장소"가 맞아요. 관사 the도 빠졌어요.'),
        o('I should meet.', '장소를 묻는 질문에 대답하지 않았어요.'),
      ] },
      { npc: 'Perfect. See you at seven!', ko: '좋아. 7시에 보자!', options: [
        o('See you then. Thanks for being flexible!', '"flexible"은 융통성 있게 맞춰 줬다는 칭찬이에요.', true),
        o('See you yesterday.', '"yesterday"는 과거라서 앞으로 만날 약속에 맞지 않아요.'),
        o("Goodbye. I'm not coming.", '약속을 바꾼 직후에 안 가겠다고 하면 모순이고 무례해요.'),
      ] },
    ],
  },
  {
    id: 'daily_catchup', kind: 'daily', emoji: '🧑', npcName: 'Jun', title: '오랜만에 안부 묻기',
    turns: [
      { npc: 'Long time no see! How have you been?', ko: '오랜만이에요! 어떻게 지냈어요?', options: [
        o("I've been good, thanks. How about you?", `"How have you been?"에는 현재완료 "I've been ~"으로 답하는 게 자연스러워요.`, true),
        o('I was good, thanks. How about you?', `문법은 맞지만 오랜만의 안부에는 현재완료(I've been)가 더 자연스러워요.`),
        o("I'm thirty years.", '나이를 말해서 질문과 맞지 않고, 표현도 "thirty years old"가 맞아요.'),
      ] },
      { npc: 'Pretty good. I started a new job last month.', ko: '꽤 좋아요. 지난달에 새 직장을 시작했어요.', options: [
        o("That's great! How do you like it?", '"How do you like ~?"는 어떤지 감상을 묻는 표현이에요.', true),
        o("That's great! How do you look it?", '"look"은 "보이다"라서 뜻이 달라져요.'),
        o("That's too bad.", '좋은 소식에 "too bad(안됐네요)"는 반대되는 반응이에요.'),
      ] },
      { npc: "I like it, but it's pretty busy.", ko: '마음에 들지만 꽤 바빠요.', options: [
        o("I understand. Let's catch up soon.", '"catch up"은 밀린 이야기를 나눈다는 뜻이에요.', true),
        o("I understand. Let's catch the bus soon.", '"catch the bus(버스를 타다)"로 뜻이 달라져요.'),
        o("That's fine. Don't call me.", '바쁘다는 말에 연락하지 말라고 하면 무례해요.'),
      ] },
    ],
  },
  {
    id: 'biz_deadline', kind: 'business', emoji: '👩‍💼', npcName: 'Ms. Lee (팀장)', title: '마감 연장 요청',
    turns: [
      { npc: 'Do you have a minute? I wanted to check on the report.', ko: '잠깐 시간 있어요? 보고서 진행 확인하려고요.', options: [
        o('Sure. I need a little more time to finish it.', '"need more time"으로 솔직하고 공손하게 상황을 말했어요.', true),
        o('Sure. I finish it yesterday.', '"yesterday"는 과거인데 동사는 현재형이라 틀려요.'),
        o("No. I'm not finishing.", '일을 안 하겠다는 뜻이라 직장에서 무례해요.'),
      ] },
      { npc: 'When can you send it to me?', ko: '언제 보내줄 수 있어요?', options: [
        o('Would Friday morning be okay?', '"Would ~ be okay?"는 공손하게 제안할 때 써요.', true),
        o('Friday morning, you wait.', '"당신이 기다려라"라는 명령조라 무례해요.'),
        o('Last Friday morning.', '과거라서 앞으로 보낼 날짜와 맞지 않아요.'),
      ] },
      { npc: 'Friday works. Please let me know if anything changes.', ko: '금요일 좋아요. 변동 있으면 알려줘요.', options: [
        o("Of course. I'll keep you updated.", '"keep + 사람 + updated"는 계속 진행 상황을 알린다는 뜻이에요.', true),
        o("Of course. I'll keep you update.", '"keep you updated"처럼 p.p.(updated)가 와야 해요.'),
        o("Maybe. I don't know.", '무책임하게 들려서 직장에서는 좋지 않아요.'),
      ] },
    ],
  },
  {
    id: 'biz_phone', kind: 'business', emoji: '📞', npcName: 'Mr. Davis (전화)', title: '전화 메시지 받기',
    turns: [
      { npc: 'Hello, may I speak to Ms. Kim?', ko: '여보세요, Kim 씨와 통화할 수 있을까요?', options: [
        o("She's not in right now. Can I take a message?", '"Can I take a message?"는 전화 응대의 대표 표현이에요.', true),
        o('She is not exist. Can I take message?', '"exist"는 쓸 수 없고, a message처럼 관사도 필요해요.'),
        o('Wrong number. Goodbye.', '퉁명스럽게 끊어 버리는 말이라 응대로 적절하지 않아요.'),
      ] },
      { npc: 'Yes, please tell her that David called.', ko: '네, David가 전화했다고 전해주세요.', options: [
        o('Sure. Could you spell your last name, please?', '"spell"은 철자를 말해 달라는 뜻이에요.', true),
        o('Sure. Could you speaking your name?', '"Could you" 뒤에는 동사원형(speak)이 와요.'),
        o('Sure. I forgot to Ms. Kim.', '문장의 뜻이 통하지 않아요.'),
      ] },
      { npc: "It's D-A-V-I-S. My number is 555-0123.", ko: 'D-A-V-I-S입니다. 번호는 555-0123이에요.', options: [
        o("Got it. I'll pass the message to her. Thank you for calling.", '"pass the message"는 메시지를 전달한다는 뜻이에요.', true),
        o("Got it. I'll pass the message to she.", '전치사 to 뒤에는 목적격(her)이 와요.'),
        o('Got it. Thank you for calling me back tomorrow.', '아직 전화하지도 않았는데 "내일 다시 전화해 줘서"라고 해서 어색해요.'),
      ] },
    ],
  },
  {
    id: 'biz_lunch', kind: 'business', emoji: '👩‍💻', npcName: 'Hana (동료)', title: '동료와 점심 약속',
    turns: [
      { npc: "It's almost noon. Do you want to grab lunch?", ko: '곧 12시예요. 점심 먹으러 갈래요?', options: [
        o('Sure, that sounds great. Where do you want to go?', '"sounds great"로 수락하고 장소를 되물었어요.', true),
        o('Sure, that sounds greatly.', '"sound" 뒤에는 부사가 아니라 형용사(great)가 와요.'),
        o("No, I'm Monday.", '문장의 뜻이 통하지 않아요.'),
      ] },
      { npc: "There's a new Korean place nearby. Is that okay?", ko: '근처에 새 한식당이 있어요. 괜찮아요?', options: [
        o("I'd love to. I haven't tried it yet.", '"haven\'t + p.p. ... yet"은 아직 해본 적 없다는 현재완료 표현이에요.', true),
        o("I'd love to. I didn't try it yet.", '"yet"과 함께는 보통 현재완료(haven\'t tried)를 써요.'),
        o("I'd love to. I'll try it ago.", '"ago"는 과거 표현이라 미래(will)와 함께 쓸 수 없어요.'),
      ] },
      { npc: 'Great! My treat today.', ko: '좋아요! 오늘은 제가 살게요.', options: [
        o("That's very kind of you. Thank you!", '"That\'s kind of you"는 호의에 대한 정중한 감사 표현이에요.', true),
        o("That's very kind for you.", '관용 표현은 "kind of you"예요.'),
        o('No way. You pay.', '상대의 호의를 거절하는 무례한 말투예요.'),
      ] },
    ],
  },
]

export const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]))

/** 보기를 섞는다 (매번 정답 위치가 달라지게). 같은 시드면 같은 순서. */
export function shuffled<T>(list: readonly T[], rnd: () => number = Math.random): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 틀린 횟수 → 별 개수 (0번 3개, 1~2번 2개, 3번 이상 1개) */
export const starsFor = (mistakes: number) => (mistakes <= 0 ? 3 : mistakes <= 2 ? 2 : 1)
/** 남은 하트 (틀릴 때마다 하나씩 줄고 0 아래로는 내려가지 않음) */
export const heartsLeft = (mistakes: number) => Math.max(0, 3 - mistakes)

/** 오답을 골랐을 때 NPC 가 보이는 반응 (영어) */
export const REACTIONS = ['Sorry, could you say that again?', "Hmm, I'm not sure I understand.", 'Pardon?', 'Sorry? What do you mean?']
