# 같이 놀기(멀티플레이어) — `multiplayer-dev` 브랜치

한 번 「같이 놀기」에 들어가면 앱 어느 탭에 있든 계속 연결돼 있고 채팅은 모두와 한다(최대 10명). 3D 카페·농장·산책에서는 같은 곳에 있는 친구가 3D 로 보인다.
Firebase 설정이 없는 빌드(지금의 GitHub Pages 배포)는 「👥 같이 놀기」 단추가 나오지 않고 예전과 똑같이 동작한다.

## 구조

| 파일 | 하는 일 |
|---|---|
| `src/lib/mp/config.ts` | 환경변수로 Firebase 설정이 있는지 확인(Firebase 를 불러오지 않음) |
| `src/lib/mp/firebase.ts` | Firebase 앱·익명 로그인·Realtime Database 연결(이 파일만 Firebase 를 안다) |
| `src/lib/mp/firebaseTransport.ts` | `lobby/players/{uid}`(지금 있는 곳 `room`: cafe·farm·walk·none), `lobby/chat`, `lobby/boss`(같이 사냥하는 대왕 몬스터, 트랜잭션으로 💖 깎기) 읽기·쓰기, `onDisconnect` 로 접속 정리, 10명 제한 |
| `src/lib/mp/localTransport.ts` | 시험용: `?mp=local` 이면 같은 브라우저의 탭끼리(BroadcastChannel) 연결 |
| `src/lib/mp/core.ts` | 공통 규칙(인원·전송 주기·값 검사·보간) + 테스트 `core.test.ts` |
| `src/lib/mp/session.ts` | 방 들어가기/나가기, 위치 보내기(최대 초당 8번, 움직였을 때만, 5초마다 생존 신호), 채팅 |
| `src/components/remotePlayers3d.ts` | 3D 장면에 다른 플레이어(옷 입은 아바타 + 닉네임 + 채팅 말풍선)를 그리고 부드럽게 보간 |
| `src/components/MultiplayerBar.tsx` | 「👥 같이 놀기」 단추, 닉네임, 인원, 채팅 칸(App 이 화면 왼쪽에 늘 하나 그림) |
| `database.rules.json` | 데이터베이스 보안 규칙 |

기존 장면(`Cafe3D.tsx`·`Farm3D.tsx`·`Walk3D.tsx`)에는 `attachMultiplayer(w, '방')` 한 줄만 더했다(들어오면 그곳을, 나가면 'none' 을 알린다). `<MultiplayerBar />` 는 `App.tsx` 에 하나.
Firebase SDK 는 「들어가기」를 누를 때 처음 받는다(동적 import, 별도 파일) → 멀티플레이어를 안 쓰면 앱 크기가 그대로다.

## 설정

1. Firebase 콘솔(프로젝트 `ryuso-game`) > 프로젝트 설정 > 내 앱(웹)의 `firebaseConfig` 값을 확인한다.
2. `.env.example` 을 `.env.local` 로 복사해서 채운다(`.env.local` 은 git 에 올라가지 않는다).
   - `VITE_FIREBASE_DATABASE_URL` 은 Realtime Database 화면 위쪽 주소(예: `https://ryuso-game-default-rtdb.<지역>.firebasedatabase.app`)
   - 서비스 계정 비공개 키는 넣지 않는다(필요 없다).
3. Realtime Database > 규칙 에 `database.rules.json` 내용을 붙여 넣고 게시한다.
   - 로그인한(익명 포함) 사용자만 읽을 수 있고, 각자 자기 `players/{uid}` 만 쓰고 지울 수 있다.
   - 채팅은 자기 uid 로만 새 글을 쓰고, 자기 글만 지울 수 있다(남의 글 수정 불가). 이름 12자·채팅 80자·좌표 범위·필드 모양을 검사한다.
   - `room` 은 `cafe`·`farm`·`walk`·`none` 중 하나.
4. Authentication > 로그인 방법 에서 「익명」이 켜져 있는지 확인한다.

## 두 브라우저에서 동시 접속 시험

```bash
git checkout multiplayer-dev
npm ci
cp .env.example .env.local   # 값 채우기
npm run dev
```

1. 크롬에서 개발 서버 주소(예: `http://localhost:5173/`)를 연다.
2. 다른 브라우저(또는 크롬 시크릿 창)에서 같은 주소를 연다 — 시크릿 창은 익명 uid 가 달라서 다른 플레이어가 된다.
3. 두 창 모두 「카페」 탭(3D) → 왼쪽 「👥 같이 놀기」 → 닉네임 → 「들어가기」.
4. 한쪽에서 땅을 누르거나 WASD 로 걸으면 다른 쪽 화면에 그 캐릭터가 부드럽게 따라 움직인다. 채팅을 보내면 머리 위 말풍선과 채팅 칸에 보인다.
5. 한쪽 창을 닫으면 몇 초 안에 다른 쪽 인원이 줄고 캐릭터가 사라진다(`onDisconnect`).
6. 같은 와이파이의 폰으로 보려면 `npm run dev -- --host` 로 띄우고 폰에서 PC 의 주소(예: `http://192.168.0.5:5173/`)로 연다.

Firebase 없이 화면만 볼 때: `.env.local` 없이 `npm run dev` 후 `http://localhost:5173/?mp=local` 을 **같은 브라우저의 탭 두 개**로 연다.

## 배포

- `deploy-pages.yml` 은 `main` 에 push 할 때만 돈다 → 이 브랜치 작업은 배포에 영향이 없다.
- 나중에 배포에 넣을 때는 GitHub 저장소 Settings > Secrets and variables > Actions 에 `VITE_FIREBASE_*` 를 넣고, 워크플로의 `npm run build` 단계에 `env:` 로 넘겨 준다(웹 앱 설정은 공개돼도 되는 값이지만 저장소 코드에는 넣지 않는다).

## 알려진 한계

- 10명 제한은 들어가기 전에 인원을 세는 방식이라, 여러 명이 정확히 동시에 들어오면 잠깐 11명이 될 수 있다(규칙으로는 사람 수를 셀 수 없다).
- 채팅 글은 데이터베이스에 남는다(화면에는 최근 30개만). 오래된 글 정리는 나중에 Cloud Functions 나 수동으로.
- 카페 손님·주문, 농장 밭, 작은 몬스터는 각자 자기 화면의 것(공유하지 않음). 위치·방향·옷·닉네임·채팅과 산책의 **대왕 몬스터** 하나만 공유한다.
- 대왕 몬스터: 같이 놀기 중에 산책에 들어가면 보인다. 💖 40칸을 모두가 같이 채우고(한 번에 최대 3), 다 채우면 한 번이라도 친 사람은 30 코인. 풀리고 10초 뒤 길가 다른 곳에 새로 나온다. 규칙은 같은 몬스터의 hp 를 0~3 만큼 줄이기, 또는 풀리고 8초 지난 뒤 새 몬스터 내기만 허락한다(코인은 각자 기기에 저장되어 서버가 확인하지 않는다).
