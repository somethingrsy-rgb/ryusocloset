# 마법사 체스 – 준비물과 작업 프롬프트

## 1. 미리 준비·결정할 것

| 항목 | 지금 상태 | 할 일 |
|---|---|---|
| Blender | 컨테이너에 없음, download.blender.org 접속 막힘(403) | ① 환경 네트워크 설정에서 `download.blender.org` 허용, 또는 ② PyPI의 `bpy` 패키지(Python 3.11 필요)로 설치. 둘 다 안 되면 ③ 같은 모양을 Three.js 스크립트(Lathe/Extrude)로 만들어 GLB로 내보내는 방식으로 대체 |
| Three.js | 설치 안 됨 | `three`, `@types/three` 추가 |
| 체스 규칙 | 없음 | `chess.js`(검증된 규칙 라이브러리) 사용 권장. 캐슬링·앙파상·프로모션·체크메이트·스테일메이트·50수·3회 반복까지 정확 |
| AI | 없음 | 알파-베타 탐색을 Web Worker에서 실행(화면 멈춤 방지), 쉬움/보통/어려움 |
| 앱 연결 위치 | 보물 탭에 달리기·수학·점프 버튼이 있음 | 같은 줄에 "체스" 버튼 추가, 전체 화면(onFull) 사용 |
| 보상 | 다른 게임은 `earnStars`로 별 지급 | AI에게 이기면 별 지급(쉬움 10 / 보통 20 / 어려움 40 제안) |
| 소리 | `sound.ts`의 효과음·배경음 체계 | 말 이동·잡기·체크·승리 효과음, 체스 배경음악(mp3 직접 주시면 연결) |
| 용량 | 앱 이미지 51MB, mp3·그림은 실행 중 캐시 | GLB는 메시 압축(meshopt), 말 6종 합계 2MB 이하, 처음 실행 때 내려받아 캐시(precache 제외) |
| 성능 | 아이폰·아이패드 사용 | 픽셀 비율 상한 2, 그림자 1개 조명만, 60fps 목표, 화면 밖이면 렌더 중지 |
| 확인 방법 | 헤드리스 Chromium(소프트웨어 WebGL)만 가능 | 실제 기기 확인은 직접 해주셔야 함 |
| 여러 에이전트 | 요청하시면 가능 | 말 6종 + 보드·홀 + 규칙·AI로 나눠 동시 작업, 토큰을 많이 씀 |

정해주시면 좋은 것 (안 정하면 괄호 안 값으로 진행):
- 체스 버튼 위치 (보물 탭 게임 버튼 줄)
- AI 승리 보상 별 (10/20/40)
- 기본 시점 (흰색 쪽에서 비스듬히 내려다보기, 두 손가락으로 회전 가능)
- 세로 화면 지원 (가로·세로 모두)

## 2. 작업 프롬프트 (그대로 복사해서 쓰기)

```
류소 옷장 앱(React 19 + TS + Vite + Tailwind v4 PWA)에 해리포터 마법사 체스 느낌의 3D 체스 게임을 추가해줘.
브라우저에서 Three.js로 실행되게 하고, 보물 탭의 달리기·수학·점프 버튼 줄에 "체스" 버튼으로 연결해줘(전체 화면, onFull 사용).

[말 모델]
- 말 모델(킹·퀸·룩·비숍·나이트·폰)은 블렌더 Python 스크립트로 만들어 GLB로 내보내. 스크립트도 저장소(tools/chess/)에 넣어서 다시 만들 수 있게.
- 흰색: 상아색 몸체 + 금장식(띠·왕관·테두리). 검은색: 광택 있는 흑도자기 + 금장식. PBR 재질(금은 metalness 높게).
- 모양은 고전 스타운턴 실루엣을 기본으로, 마법사 체스처럼 조각상 느낌(나이트는 말 머리 조각, 룩은 성탑, 비숍은 주교관).
- 말 하나당 GLB 300KB 이하, meshopt 압축, 원점은 바닥 중앙, 크기는 칸 너비 기준으로 통일.
- 블렌더를 설치할 수 없으면 같은 모양을 Three.js 스크립트(LatheGeometry 등)로 만들어 GLB로 내보내는 방식으로 대신하고, 그렇게 했다고 알려줘.
- 말마다 작업을 나눠서 여러 에이전트가 동시에 만들게 해줘(말 6종 + 보드·홀 + 규칙·AI). 각 에이전트에게 위 공통 규격을 그대로 전달해.

[연출]
- 말이 움직일 때는 미끄러지듯 살짝 떠서 이동, 나이트는 점프하듯 포물선.
- 말을 잡을 때 공격 애니메이션: 공격하는 말이 다가가 내려치고, 불꽃 파티클 + 잡힌 말이 여러 조각으로 부서져 튀었다 사라짐(1초 안팎). 아이가 보는 앱이니 무섭지 않게 밝은 색감.
- 체크일 때 킹 주변에 빨간 빛, 체크메이트·무승부 때 결과 화면.
- 배경은 성 안의 돌벽 홀: 돌벽·돌바닥, 높은 아치형 창문으로 빛줄기(볼류메트릭 느낌은 가벼운 방식으로), 횃불의 따뜻한 빛. 보드는 대리석 체스판.

[게임]
- 버튼: 혼자 두기(한 기기에서 둘이), AI와 두기(쉬움·보통·어려움, 색 선택), 새 게임, 무르기, 나가기.
- 체스 규칙은 정확하게: chess.js 사용. 캐슬링·앙파상·프로모션(말 고르는 창)·체크·체크메이트·스테일메이트·50수·3회 반복·기물 부족 무승부.
- AI는 Web Worker에서 알파-베타 탐색(난이도별 깊이·실수 확률), 생각하는 동안 화면이 멈추지 않게.
- 조작: 말을 탭하면 갈 수 있는 칸 표시, 칸을 탭하면 이동. 두 손가락으로 시점 회전·확대(범위 제한).
- 진행 중인 판은 localStorage에 저장해서 다시 열면 이어서.
- AI에게 이기면 earnStars로 별 보상(쉬움 10, 보통 20, 어려움 40).
- 소리는 sound.ts 체계를 따라: 이동, 잡기, 체크, 승리/패배 효과음(기존 효과음 재사용), EFFECT_VOL 적용.

[성능·용량]
- 아이폰·아이패드에서 부드럽게: devicePixelRatio 상한 2, 그림자는 주 조명 하나, 게임을 닫으면 렌더러·지오메트리·텍스처 dispose.
- GLB·텍스처는 precache에서 빼고 런타임 CacheFirst로(vite.config.ts의 기존 음악 파일 방식과 같이).
- Three.js와 체스 코드는 체스 화면을 열 때만 불러오게(dynamic import), 처음 앱 로딩이 느려지지 않게.

[확인]
- 규칙과 AI는 vitest로 테스트(특수 규칙 각각, 체크메이트 판정, AI가 항상 합법 수만 둠).
- 다 만들면 헤드리스 Chromium으로 직접 몇 수 두어보고(가로 1180×820, 세로 390×844) 스크린샷으로 확인해서
  어색한 모양(말 비율·떠 있음·겹침)과 움직임(이동 경로·잡기 연출 타이밍)을 고친 다음 끝내.
- tsc, vitest 통과 후 새 브랜치로 PR. 실제 기기에서는 확인 못 했다고 알려줘.
```

## 3. (선택) 배경 그림 프롬프트

돌벽·창문을 3D로만 만들면 단조로울 수 있어요. 아래 그림을 만들어 주시면 홀 벽 텍스처로 씁니다.

- 돌벽 텍스처: `Seamless tileable medieval castle stone wall texture, warm grey limestone blocks with mortar, soft even lighting, no shadows, top-down orthographic, 2048x2048, game texture, cute storybook style`
- 돌바닥 텍스처: `Seamless tileable castle hall floor, large worn flagstones, warm grey, soft even lighting, no shadows, top-down orthographic, 2048x2048, game texture, storybook style`
- 창문 빛 배경(원경): `Grand castle great hall interior, tall gothic arched windows with golden sunlight beams streaming in, floating candles, stone walls, magical warm atmosphere, cute storybook illustration, no people, no chess board, wide 16:9`
