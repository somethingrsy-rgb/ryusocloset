# 주방 가로 그림 다시 만들기 프롬프트

## 왜 다시 필요한가

- 지금 가로 주방 그림(`public/kitchen/kitchen_wide.webp`, 1672×941)은 싱크대가 그림 한가운데, 아일랜드 바로 뒤에 있음
- 아바타는 아일랜드 뒤에 서는데, 가운데에 세우면 머리(그림 높이 약 28~40%)가 싱크대(약 34~46%)를 그대로 가려서, 씻기 단계의 물방울·당근이 아바타 얼굴 위에 그려짐
- 그래서 지금은 가로 화면에서만 아바타를 오른쪽(64%)으로 비켜 세워 둠
- 세로 그림은 싱크대가 아바타 머리보다 위에 있어서 가운데에 서도 괜찮음

새 그림에서는 **싱크대·수도꼭지가 아바타 머리 위쪽**에 오도록, 뒤쪽 조리대를 더 높이 올리거나 아일랜드를 더 앞(아래)으로 내리면 아바타를 가운데에 세울 수 있음

## 그림 만들기 프롬프트 (그대로 복사)

```
A cozy cartoon kitchen background for a children's cooking game, wide landscape 16:9 (1672x941). Same style as a warm storybook illustration: soft 3D cartoon look, warm wood tones, cream and mint colors, gentle sunlight. Front view, eye level.

Layout (very important):
- Left side: a mint-green retro two-door refrigerator (from about 12% to 27% of the width), with a small potted plant on top, and a wooden vegetable shelf with carrots and tomatoes at the far left edge.
- Back wall in the middle: a big arched wooden window with red-and-white gingham curtains and a view of green trees.
- The back counter runs along the wall and sits HIGH: its countertop is at about 30% of the image height from the top. A white farmhouse sink with a dark metal faucet is set into this counter in the middle, directly under the window. The whole sink (faucet top to sink bottom) must stay between 15% and 30% of the image height. Wooden cabinets with round knobs below the counter.
- Right side: a cream retro stove with a red pot on the burner (burner top at about 32% height) and an oven below with a glass window, a white range hood with a heart above, wooden shelves with bowls, and hanging utensils.
- Front middle: a large wooden kitchen island with a thick butcher-block top, seen from the front, centered horizontally (from about 24% to 76% of the width). Its top surface starts at about 52% of the image height and the island fills down to the bottom edge. A wooden cutting board lies in the middle of the island top.
- Leave an EMPTY floor area between the back counter and the island, in the center, from about 30% to 52% of the image height, with nothing standing there: a character will be placed there later, standing behind the island, and must not cover the sink.
- No people, no animals, no text.
```

## 그림이 오면 할 일 (Claude 에게)

```
public/kitchen/kitchen_wide.webp 를 새 그림으로 바꾸고, src/components/KitchenGame.tsx 의 SPOTS.wide 자리 값을 새 그림에 맞춰 다시 재 줘:
at(냉장고·싱크대·가스레인지·오븐·도마), ovenGlass, fx(ice 냉장고 위칸, tap 수도꼭지 끝과 개수대 테두리, drop 물방울 너비, pot 냄비 바닥), island(아일랜드만 오려 낸 public/kitchen/island_wide.webp 와 자리), cook(아바타 발 위치를 가운데 [50, …] 로).
아바타 머리가 싱크대를 가리지 않는지, 씻기 물방울·농작물·도마 위 도구·오븐 불꽃이 제자리인지 헤드리스 스크린샷(패드 1180×820, 폰 가로 844×390)으로 확인해 줘.
```
