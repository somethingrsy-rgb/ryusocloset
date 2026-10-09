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

### GitHub Pages 자동 배포
`main` 에 푸시(머지)할 때마다 `.github/workflows/deploy-pages.yml` 이 타입 검사 → 테스트 → 빌드 → 배포를 실행합니다.
처음 한 번만 저장소 **Settings → Pages → Build and deployment → Source 를 `GitHub Actions`** 로 바꿔 주세요.
배포 주소: `https://<계정>.github.io/<저장소 이름>/` (Actions 탭에서 `Deploy to GitHub Pages` 실행 결과에도 표시됨)
※ 비공개 저장소는 요금제에 따라 Pages 를 쓸 수 없을 수 있습니다.
휴대폰 브라우저에서 "홈 화면에 추가"하면 앱처럼 설치됩니다.

## 기능

- 카테고리 탭(상의/하의/원피스/아우터/신발/액세서리/가방) → 썸네일을 탭하면 즉시 착용, 같은 옷을 다시 누르면 벗기
- **드래그 앤 드롭:** 옷 썸네일을 아바타 쪽으로 끌어다 놓으면 입혀짐 (터치는 꾹 눌러서 끌기 시작 — 짧게 누르면 기존처럼 탭으로 착용/해제, 마우스는 바로 끌기)
- **옷 위치·크기 조절:** 입은 옷을 눌러 선택하면 점선 테두리가 생김 → 한 손가락으로 끌어 옮기고, **두 손가락 핀치**(또는 마우스 휠, ➖➕ 버튼, 키보드 `+` `-` 방향키)로 크기 조절(60%~160%), `↺` 로 원래대로, `✕` 로 벗기. 선택한 옷 밖 어디서든 핀치가 됩니다. 조절값은 코디 저장·불러오기·PNG 내보내기·방 화면 아바타에도 반영됨
- 같은 카테고리는 1개만 착용(교체), **원피스 ↔ 상의/하의 자동 해제**, 아우터만 입는 것도 가능
- 신발을 신으면 기본 슬리퍼가 사라지고 맨발 몸 + 신발이 합성됨
- 착용 시 "찰칵" 효과음(WebAudio 합성, 에셋 없음)과 작은 바운스 애니메이션 (OS의 "동작 줄이기" 설정을 따름)
- 스티커처럼 합성 결과 윤곽을 따라 흰 테두리 + 그림자
- 배경 선택(단색/그라데이션/도트/스트라이프/투명), 랜덤 코디, 전체 벗기기
- 내 코디 저장·불러오기·삭제(최대 30개, localStorage), 새로고침해도 마지막 코디 유지
- PNG 저장/공유: 배경 포함/투명, 스티커 테두리 켜기/끄기
- 한국어/영어, 큰 터치 영역, 아이콘 중심 UI

### 조립 탭 (상단 `🧩 조립`) — 머리 · 상의 · 하의를 따로 고르기

옷이 몸과 어긋나는 문제를 피하려고 몸통을 없애고 **머리 / 팔·손이 붙은 상의 / 다리·발이 붙은 하의** 로 나눠 조립합니다. 상의와 하의가 각자 팔·손, 허리·다리·발을 가지고 있어서 몸에 맞출 필요가 없습니다.
- 탭: 머리 · 상의 · 하의 · 신발. 탭하면 입고, 같은 상의·하의를 다시 탭하면 벗습니다(머리는 교체만).
- **코디 탭과 같은 조작:** 썸네일을 꾹 눌러(마우스는 바로) **아바타 쪽으로 끌어다 놓기**, 입은 부품을 눌러 선택하면 점선 테두리 → **한 손가락으로 옮기기**, **두 손가락 핀치**(휠, ➖➕ 버튼, 키보드 `+` `-` 방향키 포함)로 크기 조절(60%~160%), `↺` 원래대로, `✕` 벗기. 새로 입은 부품은 바로 선택됩니다.
- 위치·크기 조절은 부품마다 저장되고 이미지 저장에도 반영됩니다. 다른 부품으로 바꾸면 그 칸의 조절값은 초기화됩니다.
- 랜덤, 전체 벗기기(머리만 남김), 배경, 이미지 저장(스티커 테두리 포함)이 있고 선택은 자동 저장됩니다.
- 레이어(아래→위): 하의 < 신발 < 상의(팔 포함) < 머리. 몸통과 속옷은 없어서, 하의를 안 입으면 상의 아래가 비어 있습니다.

**에셋**
- 상의: `assets-src/assemble/tops/top_*.png` (팔 포함 원본 1928×816). 빌드가 0.545배로 줄여 아바타 캔버스 (x −10, y 624)에 놓습니다.
- 하의: `assets-src/assemble/bottoms/bottom_*.png` (다리·발 포함 889×1770). 위쪽의 맨살 허리 조각에서 가장 좁은 줄을 아바타 허리(y 840, 폭 177)에 맞추고, 발끝이 캔버스 안(y 1520)에 오도록 균일 배율을 정합니다. 계산: `python tools-py/fit_assemble_bottoms.py` → `scripts/assemble-bottoms-fit.json`
- 신발: `assets-src/assemble/shoes/shoes_*.png` (발목이 보이는 한 쌍, 2170×725). 두 짝의 가운데·폭을 아바타 두 발에 맞추고 발끝을 y 1512 에 두는 값을 `python tools-py/fit_assemble_shoes.py` → `scripts/assemble-shoes-fit.json` 으로 계산합니다. 하의는 맨발까지 그려져 있어 신발이 그 위를 덮습니다.
- 머리: `assets-src/assemble/base/head_*.png` (1024×1536 캔버스). 원본에서 `python tools-py/make_assemble_base.py` 로 만듭니다.
- 이름·색은 `scripts/assemble-items.json`. 새 부품을 넣고 `npm run assets` 를 실행하면 `src/data/assemble-items.json` 이 갱신됩니다.
- 한계: 이 탭에는 아우터·원피스·액세서리·코디 저장이 없습니다. 하의 이미지마다 다리 길이가 달라 균일 배율로 맞추면 허리나 발 위치가 조금 차이 날 수 있으니 앱에서 손가락으로 맞추세요.

### 내 방 꾸미기 (상단 `🏠 내 방` 탭)

- 하단 트레이(가구 / 벽 장식 / 조명)에서 탭하면 방에 놓이고, **끌어서 옮기기**
- 선택하면 상단에 도구줄: 작게 · 크게 · 좌우 반전 · 치우기. 두 손가락 **핀치**, 마우스 **휠**, 키보드(방향키 이동, `+`/`-` 크기, `F` 반전, `Delete` 삭제)도 지원
- **아바타도 방 안에서 옮기고 크기를 바꿀 수 있고**, 지금 입은 코디 그대로 서 있음. 가구와 아바타는 바닥 기준 y 위치로 앞뒤가 자동 정렬되고(아래쪽이 앞), 바닥에 닿는 물건에는 은은한 그림자가 생김
- 레이어 순서: 바닥 < 벽지 < 러그 < 벽 장식 < (가구·아바타, y 순) < 조명 효과
- 투명한 부분을 눌러도 뒤에 있는 물건이 선택되도록 알파 마스크로 터치 판정
- 방 상태는 localStorage 에 자동 저장(최대 40개), `🧹` 로 처음 모습으로 초기화, `📷` 로 방 사진 PNG 저장/공유
- **내 옷 추가**: 코디 탭의 `+ 내 옷 추가` 버튼으로 사진(PNG·JPG 등)을 올리면 상의·하의·원피스·아우터·신발·액세서리·가방 중 고른 종류의 기본 자리에 놓이고 바로 입혀집니다. 흰색·단색 배경은 자동으로 지우고(끌 수 있음), 위치·크기는 다른 옷처럼 손가락으로 맞춥니다. 기기(IndexedDB)에만 저장되고 최대 60개이며, 내 옷 왼쪽 위 ✕ 로 삭제합니다. 코드: `src/lib/customItems.ts`, `src/components/AddItemModal.tsx`
- **삭제**: 옷·방 물건 왼쪽 위 ✕ 로 삭제합니다. 내가 추가한 것은 진짜로 지우고, 기본 옷·물건은 목록에서 숨기며 목록 맨 아래 `↩ 삭제한 N개 되돌리기` 로 다시 꺼냅니다(숨김은 기기에만 저장). 원피스 PNG 처럼 잘라서 받은 옷은 `python tools-py/place_dresses.py <폴더>` 로 캔버스에 놓습니다.
- **내 소품 추가(내 방)**: 내 방 탭의 `+ 내 소품 추가` 로 사진을 올려 가구·러그·벽 장식·조명으로 추가하면 방에 바로 놓입니다. 배경 지우기·저장(IndexedDB, 최대 60개)·삭제(✕, 방에 놓인 것도 함께 치움)는 내 옷과 같습니다.


## 폴더 구조

```
assets-src/                 원본 에셋 (직접 편집하는 곳)
  clothes/*.png             옷 PNG — 1024×1536 투명 배경(아바타와 같은 캔버스)
  base/body.png             기본 몸 — 속옷 차림, 정면 자세, 맨발 (1024×1536)
  base/body_barefoot.png    맨발 몸 (신발 착용 시 이쪽으로 교체)
  base/hair_front.png       앞머리·옆머리 (옷 위에 덮는 레이어)
  base/source/standing_avatar_transparent.png   body 를 만든 원본(정면 자세, 투명 PNG, 1024×1536)
  base/source/standing_avatar_original.png      흰 배경 원본
  room/wall.webp, floor.webp            벽지(1086×1448, 아래쪽은 투명), 바닥
  room/items/<그룹>_<이름>.webp          가구·벽 장식·조명 (그룹: furniture / rug / wall / light)
scripts/
  build-assets.ts           assets-src → public/assets(webp, 썸네일) + src/data/items.json 생성
  build-room.ts             assets-src/room → public/assets/room (여백 트림, webp, 썸네일) + src/data/room-items.json
  room-items.json           방 아이템 이름, 기본 크기(baseWidth), 기본 위치(x, y)
  build-icons.ts            PWA 아이콘 생성
  labels.json               파일명 → 한/영 이름 (+ category/color 덮어쓰기)
  fit.json                  옷별 자동 맞춤값 (가로·세로 배율, 이동) — tools-py/autofit_clothes.py 가 계산, 빌드 때 옷 이미지에 반영
tools-py/                   파이썬 도구 (스티커 테두리 제거, 원본 → 캔버스 정렬 + 맨발 몸 생성, 옷 자동 맞춤)
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
  components/               LayerStage(코디·조립 공용 무대: 선택/이동/핀치), Stage, AssembleStage, Closet, AssembleTray, useThumbDrag(끌어다 놓기), RoomView, RoomTray, 모달들
```

## 합성 규칙 (중요)

- 아바타와 옷 PNG의 캔버스는 **1024×1536** 이고, 옷은 아바타 위 **(0, 0)** 에 캔버스 전체를 그대로 겹칩니다. 자르거나 가운데 정렬하지 마세요.
- 옷 51벌은 모두 **현재 아바타(정면 자세) 기준으로 새로 그린 옷**이라 정확히 맞습니다(`scripts/labels.json` 의 `native: true`). 새 옷은 **1024×1536** 캔버스(아바타와 같은 크기)에 맞춰 같은 이름으로 `assets-src/clothes/` 에 넣고 `native: true` 로 표시하세요.
- 예전 파일명이 바뀐 옷은 `src/lib/items.ts` 의 `ID_ALIASES` 로 이어받아서, 이전에 저장한 코디와 마지막 코디가 그대로 불러와집니다. 옷 파일명을 바꾸면 여기에도 추가하세요.
- 레이어 순서(아래→위): 몸 < 신발 < 하의 < 상의 < 원피스 < 아우터 < **앞머리** < 액세서리 < 가방
- 앞머리 레이어가 아우터 위에 한 번 더 올라가서 어깨 위로 내려온 머리가 옷 앞에 보입니다.

## 옷 자동 맞춤 (속옷이 옷 옆으로 비치는 것 줄이기)

옷은 각각 따로 그려진 그림이라 몸에 대한 폭·높이가 조금씩 다릅니다. 특히 바지·스커트가 몸 엉덩이 폭보다 좁게 그려져 옆으로 속옷이 보였습니다.
`tools-py/autofit_clothes.py` 가 아바타의 속옷(외곽선으로 둘러싸인 영역)을 찾고, 옷마다 **속옷이 옷의 가로 범위 밖으로 삐져나온 픽셀 수**를 줄이는 가로·세로 배율과 이동값을 계산해 `scripts/fit.json` 에 저장합니다.
`native: true` 인 옷·신발·소품은 건너뛰므로, 지금은 모든 옷이 새로 그린 옷이라 보정값이 비어 있습니다(`scripts/fit.json` = `{}`). 아바타와 어긋나는 옛 옷을 쓸 때만 필요한 도구입니다. `npm run assets` 가 이 값을 읽어 옷 이미지에 적용합니다. 원본은 `assets-src/clothes` 에 그대로 있습니다.

```bash
pip install numpy scipy opencv-python-headless pillow
python tools-py/autofit_clothes.py   # scripts/fit.json 갱신 (옷이나 아바타를 바꿨을 때)
npm run assets                       # 보정을 반영해 public/assets 다시 생성
```

그래도 마음에 안 드는 옷은 앱에서 직접 손가락으로 옮기고 크기를 조절할 수 있습니다. (이 값은 보정 위에 얹힙니다)
**한계:** 보정은 가로·세로 배율과 이동뿐이라 옷 모양 자체(어깨선, 소매 각도)를 바꾸지는 못합니다. 아바타 몸 비율이 달라지면 보정으로는 한계가 있고, 새 몸 기준으로 옷을 다시 그리는 것이 맞습니다.

## 새 옷 추가하는 법

1. 투명 배경 1024×1536 PNG(아바타와 같은 캔버스)를 `assets-src/clothes/` 에 넣습니다. 파일명 규칙: `카테고리_이름_색상.png`
   - 카테고리 접두사: `top_` `bottom_` `dress_` `outer_` `shoes_` `acc_`
   - `acc_` 는 이름에 `bag/backpack/briefcase/handbag/tote` 가 있으면 **가방**, 아니면 **액세서리**로 분류됩니다.
   - 마지막 단어가 색상표(black, ivory, navy, gray, brown, beige, khaki, mint, charcoal, skyblue, white)에 있으면 색 점이 표시됩니다.
2. (선택) `scripts/labels.json` 에 한/영 이름을 추가합니다. 없으면 파일명으로 이름이 만들어집니다.
3. `python tools-py/autofit_clothes.py` 로 맞춤값을 갱신하고(바지·스커트·원피스일 때 특히), `npm run assets` 를 실행하면 webp 변환, 썸네일, `src/data/items.json` 이 갱신됩니다.
4. 새 색상이 필요하면 `scripts/build-assets.ts` 의 `COLORS` 에 추가하세요.

에셋이 없거나 깨진 경우를 대비해 `npm run assets` 가 크기가 1024×1536 이 아닌 파일에 경고를 출력합니다.

## 새 가구·소품 추가하는 법

1. 투명 배경 PNG(또는 webp)를 `assets-src/room/items/` 에 넣습니다. 파일명 규칙: `그룹_이름.png`
   - `furniture_`(가구) · `rug_`(러그, 가구 뒤 바닥에 깔림) · `wall_`(벽 장식) · `light_`(조명 효과, 맨 위에 겹쳐짐)
   - 캔버스 크기는 자유입니다. 투명 여백은 자동으로 잘리고, 아래 가운데가 기준점이 됩니다.
2. `scripts/room-items.json` 에 이름과 기본 크기를 적습니다. 없으면 폭 400, 방 바닥 중앙에 놓입니다.
   - `baseWidth`: 방에 놓일 때의 폭(방 폭 = 1086). 아바타 폭은 405 입니다.
   - `x`, `y`: 처음 놓이는 위치(아래 가운데 기준). 바닥은 y≈1060~1448, 벽은 그 위입니다.
3. `npm run assets` 를 실행하면 `src/data/room-items.json` 과 썸네일이 갱신됩니다.

벽지·바닥을 바꾸려면 `assets-src/room/wall.*`(1086×1448, 아래 바닥 부분 투명) 과 `floor.*` 를 교체하세요.

## 아바타(기본 몸) 바꾸는 법

- 같은 캔버스(1024×1536)로 맞춘 `body` `body_barefoot` `hair_front` 3개 PNG를 `assets-src/base/` 에 넣고 `npm run assets`.
  - `body`: 머리까지 포함한 전신, `body_barefoot`: 신발을 신었을 때 쓰는 맨발 몸(지금은 body 와 같음), `hair_front`: 옷 위에 한 번 더 덮을 앞머리
- `tools-py/make_bodysuit_layers.py <원본> assets-src/base` 가 원본(투명 PNG)에서 1024×1536 몸(`body`, `body_barefoot`)을 만들고(늘리지 않고 좌우만 잘라 맞춤), 어깨 아래로 내려오는 머리카락만 따로 뽑아 `hair_front.png` 를 만듭니다. 새 아바타는 이미 맨발이라 `body` 와 `body_barefoot` 이 같은 이미지입니다.
- 몸을 바꾸면 옷의 위치도 같이 확인하세요. 옷은 몸에 맞춰 정렬돼 있습니다.
- 헤어스타일 변형을 추가하려면 `FigureLayers.tsx` 의 `body`/`hairFront` 를 선택 가능하게 확장하면 됩니다.

## 다음 단계 아이디어

- 레벨/경험치, 포인트, 일일 미션(TPO 코디), 컬렉션 도감
- 포인트로 가구·벽지를 사서 방을 꾸미는 상점 (지금은 모든 가구가 무료로 제공됨), 벽지/바닥 종류 늘리기
- 헤어/표정 변형, 포즈 추가
