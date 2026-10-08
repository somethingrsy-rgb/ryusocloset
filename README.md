# 류소 옷장 (Ryuso Closet)

치비 아바타에 옷을 갈아입히는 **종이인형 놀이** 웹앱입니다. (React + TypeScript + Vite + Tailwind CSS, PWA, 모바일 우선)
서버·로그인·광고·결제 없이 브라우저(localStorage)만 사용합니다.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (같은 와이파이의 폰에서도 접속 가능: --host)
npm run build      # dist/ 에 정적 파일 생성 (PWA 서비스워커 포함)
npm run preview    # 빌드 결과 미리보기
npm test           # 착용 규칙 단위 테스트
```

`dist/` 폴더를 Netlify · Vercel · GitHub Pages 등 정적 호스팅에 올리면 배포 끝입니다. (`base: './'` 라서 하위 경로에서도 동작)
휴대폰 브라우저에서 "홈 화면에 추가"하면 앱처럼 설치됩니다.

## 기능

- 카테고리 탭(상의/하의/원피스/아우터/신발/액세서리/가방) → 썸네일을 탭하면 즉시 착용, 같은 옷을 다시 누르면 벗기
- 같은 카테고리는 1개만 착용(교체), **원피스 ↔ 상의/하의 자동 해제**, 아우터만 입는 것도 가능
- 신발을 신으면 기본 슬리퍼가 사라지고 맨발 몸 + 신발이 합성됨
- 착용 시 "찰칵" 효과음(WebAudio 합성, 에셋 없음)과 작은 바운스 애니메이션 (OS의 "동작 줄이기" 설정을 따름)
- 스티커처럼 합성 결과 윤곽을 따라 흰 테두리 + 그림자
- 배경 선택(단색/그라데이션/도트/스트라이프/투명), 랜덤 코디, 전체 벗기기
- 내 코디 저장·불러오기·삭제(최대 30개, localStorage), 새로고침해도 마지막 코디 유지
- PNG 저장/공유: 배경 포함/투명, 스티커 테두리 켜기/끄기
- 한국어/영어, 큰 터치 영역, 아이콘 중심 UI

### 내 방 꾸미기 (상단 `🏠 내 방` 탭)

- 하단 트레이(가구 / 벽 장식 / 조명)에서 탭하면 방에 놓이고, **끌어서 옮기기**
- 선택하면 상단에 도구줄: 작게 · 크게 · 좌우 반전 · 치우기. 두 손가락 **핀치**, 마우스 **휠**, 키보드(방향키 이동, `+`/`-` 크기, `F` 반전, `Delete` 삭제)도 지원
- **아바타도 방 안에서 옮기고 크기를 바꿀 수 있고**, 지금 입은 코디 그대로 서 있음. 가구와 아바타는 바닥 기준 y 위치로 앞뒤가 자동 정렬되고(아래쪽이 앞), 바닥에 닿는 물건에는 은은한 그림자가 생김
- 레이어 순서: 바닥 < 벽지 < 러그 < 벽 장식 < (가구·아바타, y 순) < 조명 효과
- 투명한 부분을 눌러도 뒤에 있는 물건이 선택되도록 알파 마스크로 터치 판정
- 방 상태는 localStorage 에 자동 저장(최대 40개), `🧹` 로 처음 모습으로 초기화, `📷` 로 방 사진 PNG 저장/공유

## 폴더 구조

```
assets-src/                 원본 에셋 (직접 편집하는 곳)
  clothes/*.png             옷 PNG — 모두 851×1280 투명 배경, 아바타와 같은 캔버스
  base/body.png             기본 몸(머리+몸+슬리퍼)
  base/body_barefoot.png    슬리퍼를 지운 몸 (신발 착용 시)
  base/hair_front.png       어깨 앞으로 내려온 머리카락만 (옷 위에 덮는 레이어)
  base/source_avatar_with_sticker.png   스티커 테두리가 있던 원본 아바타
  room/wall.webp, floor.webp            벽지(1086×1448, 아래쪽은 투명), 바닥
  room/items/<그룹>_<이름>.webp          가구·벽 장식·조명 (그룹: furniture / rug / wall / light)
scripts/
  build-assets.ts           assets-src → public/assets(webp, 썸네일) + src/data/items.json 생성
  build-room.ts             assets-src/room → public/assets/room (여백 트림, webp, 썸네일) + src/data/room-items.json
  room-items.json           방 아이템 이름, 기본 크기(baseWidth), 기본 위치(x, y)
  build-icons.ts            PWA 아이콘 생성
  labels.json               파일명 → 한/영 이름 (+ category/color 덮어쓰기)
tools-py/                   아바타 가공용 1회성 파이썬 도구 (스티커 제거, 레이어 분리)
public/assets/              생성물 (webp) — 직접 수정하지 않기
src/
  lib/layers.ts             카테고리, 레이어 순서(zIndex), 캔버스 크기
  lib/outfit.ts             착용 규칙(toggle/랜덤/정리) — 테스트 있음
  lib/exportPng.ts          canvas 합성 + 스티커 테두리 + PNG 내보내기
  lib/backgrounds.ts        배경 정의 (화면 CSS와 canvas 공용)
  lib/room.ts               방 상태(추가/이동/크기/반전/삭제), 그리기 순서, 검증 — 테스트 있음
  lib/roomHit.ts            알파 마스크 터치 판정
  lib/exportRoom.ts         방 + 가구 + 아바타 PNG 합성
  data/items.json           자동 생성 매니페스트 (id, 이름, 카테고리, 이미지, 색상, zIndex)
  components/               Stage(코디 무대), Closet, RoomView(방 무대), RoomTray, 모달들
```

## 합성 규칙 (중요)

- 모든 옷 PNG는 **851×1280** 이고, 아바타 위 **(0, 0)** 에 캔버스 전체를 그대로 겹칩니다. 자르거나 가운데 정렬하지 마세요.
- 레이어 순서(아래→위): 몸 < 신발 < 하의 < 상의 < 원피스 < 아우터 < **앞머리** < 액세서리 < 가방
- 앞머리 레이어가 아우터 위에 한 번 더 올라가서 어깨 위로 내려온 머리가 옷 앞에 보입니다.

## 새 옷 추가하는 법

1. 투명 배경 851×1280 PNG를 `assets-src/clothes/` 에 넣습니다. 파일명 규칙: `카테고리_이름_색상.png`
   - 카테고리 접두사: `top_` `bottom_` `dress_` `outer_` `shoes_` `acc_`
   - `acc_` 는 이름에 `bag/backpack/briefcase/handbag/tote` 가 있으면 **가방**, 아니면 **액세서리**로 분류됩니다.
   - 마지막 단어가 색상표(black, ivory, navy, gray, brown, beige, khaki, mint, charcoal, skyblue, white)에 있으면 색 점이 표시됩니다.
2. (선택) `scripts/labels.json` 에 한/영 이름을 추가합니다. 없으면 파일명으로 이름이 만들어집니다.
3. `npm run assets` 를 실행하면 webp 변환, 썸네일, `src/data/items.json` 이 갱신됩니다.
4. 새 색상이 필요하면 `scripts/build-assets.ts` 의 `COLORS` 에 추가하세요.

에셋이 없거나 깨진 경우를 대비해 `npm run assets` 가 크기가 851×1280 이 아닌 파일에 경고를 출력합니다.

## 새 가구·소품 추가하는 법

1. 투명 배경 PNG(또는 webp)를 `assets-src/room/items/` 에 넣습니다. 파일명 규칙: `그룹_이름.png`
   - `furniture_`(가구) · `rug_`(러그, 가구 뒤 바닥에 깔림) · `wall_`(벽 장식) · `light_`(조명 효과, 맨 위에 겹쳐짐)
   - 캔버스 크기는 자유입니다. 투명 여백은 자동으로 잘리고, 아래 가운데가 기준점이 됩니다.
2. `scripts/room-items.json` 에 이름과 기본 크기를 적습니다. 없으면 폭 400, 방 바닥 중앙에 놓입니다.
   - `baseWidth`: 방에 놓일 때의 폭(방 폭 = 1086). 아바타 폭은 386 입니다.
   - `x`, `y`: 처음 놓이는 위치(아래 가운데 기준). 바닥은 y≈1060~1448, 벽은 그 위입니다.
3. `npm run assets` 를 실행하면 `src/data/room-items.json` 과 썸네일이 갱신됩니다.

벽지·바닥을 바꾸려면 `assets-src/room/wall.*`(1086×1448, 아래 바닥 부분 투명) 과 `floor.*` 를 교체하세요.

## 아바타(기본 몸) 바꾸는 법

- 같은 캔버스(851×1280) 기준의 `body.png`, `body_barefoot.png`, `hair_front.png` 를 `assets-src/base/` 에 넣고 `npm run assets`.
- `hair_front.png` 와 `body_barefoot.png` 는 현재 `tools-py/make_avatar_layers.py` 로 **자동 분리한 근사치**입니다. 머리끝이나 발 모양이 거슬리면 직접 그린 PNG로 교체하면 더 깔끔합니다.
- 헤어스타일 변형을 추가하려면 `Stage.tsx` 의 `body`/`hairFront` 를 선택 가능하게 확장하면 됩니다.

## 다음 단계 아이디어

- 레벨/경험치, 포인트, 일일 미션(TPO 코디), 컬렉션 도감
- 포인트로 가구·벽지를 사서 방을 꾸미는 상점 (지금은 모든 가구가 무료로 제공됨), 벽지/바닥 종류 늘리기
- 헤어/표정 변형, 포즈 추가
