# 화면 잠금·자동 복귀·친구 알림 배포

## 동작

- 화면 숨김 또는 Firebase 연결 종료 시 `away: true`, `moving: false`만 기록한다. 참가자/열린 집은 삭제하지 않는다.
- 모든 탭에서 전경 heartbeat를 5초마다 보낸다. 15초간 소식이 없으면 친구 화면에 자리 비움으로 표시한다.
- 마지막 전경 heartbeat부터 10분간 자리를 보관한다. 숨김 이벤트나 재연결 시도가 보관 시간을 연장하지 않는다.
- 복귀 시 서버 기록을 트랜잭션으로 확인한다. 만료·삭제된 기록은 자동으로 다시 만들지 않는다.
- 새로고침/운영체제의 페이지 제거 후에도 저장된 참여 기록과 Firebase 익명 uid로 자동 복귀한다. 마지막 앱 탭과 방문 중이던 공유 집도 복원한다. 3D 장면을 새로 만드는 경우 정확한 캐릭터 좌표는 장면의 시작 위치로 바뀔 수 있다.
- 명시적으로 나가면 자동 복귀 기록과 참가자를 지운다. 서버가 열린 집·음식도 정리한다.
- 10분 만료 기록은 클라이언트에서 숨기며, 서버의 1분 주기 작업이 실제 DB 레코드와 열린 집을 삭제한다.
- 기존 글로벌 로비 구조를 유지한다. 일반 채팅/초대는 자리 비움 중인 로비 참가자에게, ‘부르기’는 선택한 친구에게만 푸시한다.
- 푸시는 동의한 기기에만 보낸다. 수신자당 30초에 최대 한 번, TTL 60초이며 만료된 구독은 제거한다. OS 설정·네트워크에 따라 전달/소리는 달라질 수 있다.
- Firebase 설정 없는 `?mp=local`은 탭 간 자리 비움 UI 확인용이다. 서버 푸시와 페이지 재생성 후 복귀는 Firebase 배포에서 확인한다.

## 필요한 서버 설정

GitHub Pages에는 서버 코드를 실행할 수 없으므로 `functions/`의 Firebase Cloud Functions를 별도로 배포해야 한다. Firebase 프로젝트의 Cloud Functions/Cloud Scheduler 사용 가능한 결제 설정(Blaze)이 필요하다. 이 변경은 운영 서비스에 자동 배포하지 않는다.

1. 프로젝트 루트에서 `npm ci`, `npm --prefix functions ci`를 실행한다. 배포 환경 Node.js는 22를 사용한다.
2. `firebase login` 으로 로그인한다. 프로젝트는 `.firebaserc` 의 기본값 `ryuso-game` 이다(아래 명령은 `--project ryuso-game` 로 한 번 더 명시한다).
3. `functions/.env.example`을 `functions/.env.ryuso-game`으로 복사한다. 지역·인스턴스·URL은 이미 실제 값으로 들어 있다.
   - 지역 `asia-southeast1`, 인스턴스 `ryuso-game-default-rtdb`, URL `https://ryuso-game-default-rtdb.asia-southeast1.firebasedatabase.app`
   - 데이터베이스 트리거는 데이터베이스와 같은 지역에 배포해야 하므로 함수 지역도 `asia-southeast1`이다. 셋이 서로 맞지 않으면 `functions/config.mjs`가 배포 전에 멈춘다.
4. `functions` 폴더에서 `npx web-push generate-vapid-keys --json`으로 키 쌍을 한 번 생성한다. 공개 키는 `WEB_PUSH_PUBLIC_KEY`, 연락처는 `WEB_PUSH_SUBJECT`에 넣는다. 비공개 키는 파일이나 GitHub 변수, `VITE_*` 변수에 넣지 말고 다음 명령의 비밀 입력 프롬프트에만 입력한다.

   ```sh
   firebase functions:secrets:set WEB_PUSH_PRIVATE_KEY --project ryuso-game
   ```

5. 로컬 `.env.local` 및 GitHub 저장소 Actions **Variables**에 동일한 공개 키를 `VITE_WEB_PUSH_PUBLIC_KEY`로 넣는다.
6. 먼저 서버/규칙을 배포한다. 이 순서를 지켜야 새 `away`, `session`, `call`, 구독 필드를 기존 규칙이 거절하지 않는다.

   ```sh
   firebase deploy --only database,functions:multiplayer --project ryuso-game
   ```

7. 프런트엔드를 병합·배포한다. 기존 PWA 사용자에게 업데이트를 적용한다. 구버전 클라이언트는 기존 즉시 퇴장 방식이므로 전환 확인 때 양쪽 기기를 모두 업데이트한다.
8. 게임의 **친구 → 지난 대화(📜) → 친구 알림 켜기**를 누른다. 아이폰/아이패드에서는 iOS/iPadOS 16.4 이상, 홈 화면에 추가한 앱으로 열기, 알림 허용이 필요하다.

서버의 공개 키와 클라이언트의 공개 키는 반드시 같은 쌍이어야 한다. 키 교체 시 기기에서 알림을 껐다 켜서 다시 구독한다. 알림 구독은 사용자별 비공개 경로에 저장하고 본인만 읽고 쓸 수 있다. 발송 서버는 지원하는 푸시 서비스 HTTPS 호스트만 허용한다.

## 확인

```sh
npm test
npm run lint
npm run build
npm --prefix functions test
npm --prefix functions run check
```

서로 다른 익명 계정인 실제 기기 두 대로 다음을 확인한다.

1. 둘 다 입장 후 A를 잠근다. B에서 A가 자리 비움으로 보이고 인원과 열린 집이 유지되는지 확인한다.
2. B에서 채팅 또는 A의 ‘부르기’를 누른다. A가 푸시를 받는지 확인한다. 각각 시험할 때는 30초 간격을 둔다.
3. A가 알림을 누르면 기존 탭에 포커스하거나 앱을 새로 열어 같은 로비/장소와 최신 대화로 복귀하는지 확인한다.
4. A를 비행기 모드로 바꿨다가 10분 안에 복귀시켜 중복 참가자 없이 재연결되는지 확인한다.
5. 10분 이상 잠그면 퇴장되는지, 다시 열어도 자동 재입장이 아닌 입장 버튼이 나오는지 확인한다.
6. 직접 나간 뒤 새로고침해도 자동 재입장하지 않고 이후 새 메시지의 푸시 대상에서 빠지는지 확인한다. 이미 전송된 알림은 잠시 뒤 도착할 수 있다.
7. 집 주인의 화면을 잠가도 손님의 집 화면이 닫히지 않는지 확인한다. 주인이 직접 나가거나 만료되면 집이 닫혀야 한다.
8. 앱을 강제 종료 후 10분 안에 다시 열어 복귀를 확인한다. 브라우저 데이터 삭제로 익명 계정이 바뀐 경우에는 이전 참가자로 복귀하지 않아야 한다.

모바일 OS가 웹 페이지의 실행/소켓을 계속 보장하지 않으므로, 서비스 워커를 상시 연결 유지용으로 사용하지 않는다. 실제 잠금 화면 푸시 검증에는 위 서버 배포와 실제 기기의 알림 동의가 필요하다.
