export interface EnglishQuestion {
  line: string
  meaning: string
  choices: { en: string; ko: string }[]
  answer: number
  explanation: { ko: string; en: string }
}
type Choice = [string, string]
const q = (line: string, meaning: string, choices: Choice[], answer: number, ko: string, en: string): EnglishQuestion =>
  ({ line, meaning, choices: choices.map(([en, ko]) => ({ en, ko })), answer, explanation: { ko, en } })

/** Short conversations follow the situation in each destination. */
export const ENGLISH_LESSONS: Record<string, EnglishQuestion[]> = {
  spring: [
    q('Would you like a sandwich?', '샌드위치 드실래요?', [['Yes, please.', '네, 주세요.'], ['It is Monday.', '월요일이에요.'], ['I live near here.', '저는 이 근처에 살아요.']], 0, '권유를 받아들일 때는 “Yes, please.”라고 해요.', 'Use “Yes, please.” to accept an offer politely.'),
    q('How is the weather today?', '오늘 날씨가 어때요?', [['I am ten.', '저는 열 살이에요.'], ['It is sunny.', '맑아요.'], ['That is my bag.', '저건 제 가방이에요.']], 1, '날씨를 말할 때 “It is sunny.”를 쓸 수 있어요.', '“It is sunny.” describes the weather.'),
    q('Can I sit here?', '여기 앉아도 될까요?', [['I like apples.', '저는 사과를 좋아해요.'], ['It is three o’clock.', '세 시예요.'], ['Of course. Have a seat.', '물론이죠. 앉으세요.']], 2, '허락하고 자리를 권할 때 “Have a seat.”라고 해요.', '“Have a seat.” is a friendly invitation to sit.'),
  ],
  summer: [
    q('Where is the beach?', '해변이 어디에 있나요?', [['Go straight ahead.', '곧장 앞으로 가세요.'], ['I am hungry.', '배고파요.'], ['My name is Ryuso.', '제 이름은 류소예요.']], 0, '길을 안내할 때 “Go straight ahead.”를 써요.', '“Go straight ahead.” gives directions.'),
    q('Would you like some water?', '물 좀 드실래요?', [['It is blue.', '파란색이에요.'], ['Yes, thank you.', '네, 고마워요.'], ['I have a sister.', '저는 자매가 있어요.']], 1, '물을 권해 주면 “Yes, thank you.”로 답할 수 있어요.', 'Accept the offer with “Yes, thank you.”'),
    q('Can you swim?', '수영할 수 있나요?', [['It is my birthday.', '제 생일이에요.'], ['That is a tree.', '저건 나무예요.'], ['Yes, I can.', '네, 할 수 있어요.']], 2, '“Can you...?”에는 “Yes, I can.”으로 답할 수 있어요.', 'Answer “Can you...?” with “Yes, I can.”'),
  ],
  camp: [
    q('Do you need a flashlight?', '손전등이 필요하나요?', [['Yes, it is getting dark.', '네, 어두워지고 있어요.'], ['I am wearing shoes.', '저는 신발을 신고 있어요.'], ['The cake is sweet.', '케이크가 달아요.']], 0, '어두워지는 상황에 손전등이 필요하다고 답해요.', 'A flashlight is useful when it is getting dark.'),
    q('Are you cold?', '춥나요?', [['I like music.', '저는 음악을 좋아해요.'], ['Yes. Can I have a blanket?', '네. 담요를 받을 수 있을까요?'], ['It is a rabbit.', '토끼예요.']], 1, '“Can I have...?”로 필요한 물건을 정중하게 부탁해요.', 'Use “Can I have...?” to ask for something politely.'),
    q('What time shall we eat?', '우리 몇 시에 먹을까요?', [['It is delicious.', '맛있어요.'], ['That is my tent.', '저건 제 텐트예요.'], ['Let’s eat at six.', '여섯 시에 먹어요.']], 2, '“What time”은 시간을 묻는 말이에요.', '“What time” asks about a time.'),
  ],
  birthday: [
    q('Happy birthday!', '생일 축하해요!', [['Thank you!', '고마워요!'], ['Turn left.', '왼쪽으로 도세요.'], ['It is raining.', '비가 와요.']], 0, '축하를 받았을 때 “Thank you!”라고 답해요.', 'Say “Thank you!” when someone congratulates you.'),
    q('Would you like some cake?', '케이크 좀 드실래요?', [['My bag is pink.', '제 가방은 분홍색이에요.'], ['Yes, please. It looks delicious.', '네, 주세요. 맛있어 보여요.'], ['I go to school.', '저는 학교에 다녀요.']], 1, '“It looks delicious.”는 “맛있어 보여요”라는 뜻이에요.', '“It looks delicious.” is a nice way to compliment food.'),
    q('How old are you?', '몇 살인가요?', [['I am happy.', '저는 행복해요.'], ['I am at home.', '저는 집에 있어요.'], ['I am ten years old.', '저는 열 살이에요.']], 2, '나이는 “I am ... years old.”로 말해요.', 'Use “I am ... years old.” to say your age.'),
  ],
  halloween: [
    q('Trick or treat!', '사탕을 안 주면 장난칠 거예요!', [['Here is some candy.', '여기 사탕이 있어요.'], ['It is summer.', '여름이에요.'], ['I am going swimming.', '저는 수영하러 가요.']], 0, '핼러윈 인사에 사탕을 건네는 대답이에요.', 'Offer candy in response to this Halloween greeting.'),
    q('Are you scared?', '무섭나요?', [['It is a sandwich.', '샌드위치예요.'], ['A little, but I am okay.', '조금요. 하지만 괜찮아요.'], ['My shoes are new.', '제 신발은 새것이에요.']], 1, '“A little”은 “조금”이라는 뜻이에요.', '“A little” means a small amount.'),
    q('What is your costume?', '어떤 분장을 했나요?', [['It is five o’clock.', '다섯 시예요.'], ['The sky is blue.', '하늘이 파래요.'], ['I am dressed as a witch.', '저는 마녀로 분장했어요.']], 2, '“dressed as”는 어떤 모습으로 분장했다는 뜻이에요.', '“Dressed as” describes a costume.'),
  ],
  alice: [
    q('Would you like some tea?', '차 좀 드실래요?', [['Yes, please.', '네, 주세요.'], ['I am late for school.', '저는 학교에 늦었어요.'], ['It is my hat.', '제 모자예요.']], 0, '차를 권하는 말에 정중하게 답해요.', 'Accept a cup of tea politely.'),
    q('Do you take sugar?', '설탕을 넣으시나요?', [['It is a sunny day.', '맑은 날이에요.'], ['No, thank you.', '아니요, 괜찮아요.'], ['I have two brothers.', '저는 남자 형제가 두 명 있어요.']], 1, '권유를 정중히 거절할 때 “No, thank you.”라고 해요.', '“No, thank you.” politely declines an offer.'),
    q('Could you pass the milk?', '우유를 건네주시겠어요?', [['I live in Seoul.', '저는 서울에 살아요.'], ['The rabbit is white.', '토끼가 하얘요.'], ['Sure. Here you are.', '물론이죠. 여기 있어요.']], 2, '물건을 건넬 때 “Here you are.”라고 해요.', 'Say “Here you are.” when handing something to someone.'),
  ],
  valentine: [
    q('This gift is for you.', '이 선물은 당신을 위한 거예요.', [['Thank you. That is so kind!', '고마워요. 정말 친절하시네요!'], ['I need a flashlight.', '손전등이 필요해요.'], ['It is snowing.', '눈이 와요.']], 0, '선물을 받았을 때 감사와 기쁜 마음을 전해요.', 'Thank someone for a thoughtful gift.'),
    q('What is your favorite color?', '가장 좋아하는 색은 무엇인가요?', [['I am sleepy.', '졸려요.'], ['My favorite color is pink.', '제가 가장 좋아하는 색은 분홍색이에요.'], ['Go straight.', '곧장 가세요.']], 1, '“My favorite ... is ...”로 좋아하는 것을 말해요.', 'Use “My favorite ... is ...” to describe a preference.'),
    q('Can you help me write a card?', '카드 쓰는 것을 도와줄 수 있나요?', [['I am eight.', '저는 여덟 살이에요.'], ['The tea is hot.', '차가 뜨거워요.'], ['Of course. Let’s do it together.', '물론이죠. 함께 해봐요.']], 2, '도움을 부탁받았을 때 함께 하겠다고 답해요.', 'Offer to help by doing it together.'),
  ],
  palace: [
    q('Welcome! Please come in.', '환영해요! 들어오세요.', [['Thank you for inviting me.', '초대해 주셔서 고마워요.'], ['I can swim.', '저는 수영할 수 있어요.'], ['It is a pumpkin.', '호박이에요.']], 0, '초대받았을 때 쓸 수 있는 감사 인사예요.', 'Thank your host for the invitation.'),
    q('May I take your coat?', '외투를 받아 드릴까요?', [['I am going camping.', '저는 캠핑하러 가요.'], ['Yes, thank you.', '네, 고마워요.'], ['It is ten o’clock.', '열 시예요.']], 1, '외투를 맡아주겠다는 친절한 제안에 답해요.', 'Accept the offer to take your coat.'),
    q('Did you enjoy your visit?', '방문이 즐거우셨나요?', [['The milk is cold.', '우유가 차가워요.'], ['I am wearing a hat.', '저는 모자를 쓰고 있어요.'], ['Yes, I had a wonderful time.', '네, 정말 즐거운 시간을 보냈어요.']], 2, '“had a wonderful time”은 즐거운 시간을 보냈다는 뜻이에요.', '“Had a wonderful time” describes an enjoyable visit.'),
  ],
  christmas: [
    q('Merry Christmas!', '메리 크리스마스!', [['Merry Christmas to you, too!', '당신도 즐거운 크리스마스 보내세요!'], ['I am hungry.', '배고파요.'], ['It is my umbrella.', '제 우산이에요.']], 0, '상대에게도 같은 인사를 돌려줄 수 있어요.', 'Return the same holiday greeting.'),
    q('Would you like some hot chocolate?', '핫초코 좀 드실래요?', [['My room is upstairs.', '제 방은 위층에 있어요.'], ['Yes, please. It is cold outside.', '네, 주세요. 밖이 추워요.'], ['I have a bicycle.', '저는 자전거가 있어요.']], 1, '추운 날 따뜻한 음료를 권하는 대화예요.', 'Accept a warm drink on a cold day.'),
    q('What would you like for Christmas?', '크리스마스에 무엇을 받고 싶나요?', [['It is Thursday.', '목요일이에요.'], ['The door is open.', '문이 열려 있어요.'], ['I would like a book.', '책을 받고 싶어요.']], 2, '“I would like...”는 원하는 것을 정중히 말하는 표현이에요.', '“I would like...” politely expresses a wish.'),
  ],
  winter: [
    q('It is snowing! Shall we make a snowman?', '눈이 와요! 눈사람을 만들까요?', [['Yes! That sounds fun.', '네! 재미있겠어요.'], ['My sandwich is good.', '제 샌드위치가 맛있어요.'], ['I am at the beach.', '저는 해변에 있어요.']], 0, '제안이 마음에 들면 “That sounds fun.”이라고 해요.', '“That sounds fun.” shows enthusiasm for a suggestion.'),
    q('Do you have your gloves?', '장갑을 가지고 있나요?', [['I like cake.', '저는 케이크를 좋아해요.'], ['Yes, they are in my bag.', '네, 제 가방에 있어요.'], ['It is a sunny beach.', '햇빛이 드는 해변이에요.']], 1, '장갑처럼 여러 개로 취급하는 물건에는 “they”를 써요.', 'Use “they” for a pair of gloves.'),
    q('Would you like to warm up inside?', '안에서 몸을 녹일래요?', [['I am learning to swim.', '저는 수영을 배우고 있어요.'], ['This is my birthday card.', '이건 제 생일 카드예요.'], ['Yes, let’s go inside.', '네, 안으로 들어가요.']], 2, '추울 때 실내로 들어가자는 제안을 받아들여요.', 'Accept an invitation to go inside and warm up.'),
  ],
}
