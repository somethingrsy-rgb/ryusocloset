"""테마 묶음(폴더마다 벽지배경 / 바닥 / 소품 PNG)을 assets-src/themes/<id>/ 로 옮기고 scripts/themes.json · scripts/theme-items.json 을 만든다.

사용: python tools-py/import_themes.py <테마 묶음 폴더> [<소품만 있는 폴더(핼러윈 추가 소품)>]      (저장소 루트에서; 그 다음 npm run assets)
  - 폴더 이름(겨울왕국 등)은 THEMES 표로 id 를 정한다. 소품 이름·크기·기본 위치는 PROPS 표를 고쳐서 바꾼다.
"""
import glob
import json
import os
import shutil
import sys

pack = sys.argv[1]
extra = sys.argv[2] if len(sys.argv) > 2 else None
OUT = 'assets-src/themes'

# 폴더 → (id, 한글, 영문, 아이콘)
THEMES = {
    '겨울왕국': ('winter', '겨울왕국', 'Winter Wonderland', '❄️'),
    '밸런타인데이': ('valentine', '밸런타인데이', "Valentine's Day", '💝'),
    '봄소풍': ('spring', '봄소풍', 'Spring Picnic', '🌸'),
    '생일파티': ('birthday', '생일파티', 'Birthday Party', '🎂'),
    '여름휴가': ('summer', '여름휴가', 'Summer Vacation', '🏖️'),
    '크리스마스': ('christmas', '크리스마스', 'Christmas', '🎄'),
    '핼러윈': ('halloween', '핼러윈', 'Halloween', '🎃'),
}
# (폴더, 파일) → (이름 id, 한글, 영문, 그룹(겹치는 순서), 기본 폭, x, y)   그룹: furniture(바닥에 서 있음) / rug(바닥에 깔림) / wall(벽에 걸림)
PROPS = {
    ('겨울왕국', '눈꽃'): ('snowflake', '눈꽃', 'Snowflake', 'wall', 170, 300, 520),
    ('겨울왕국', '눈사람'): ('snowman', '눈사람', 'Snowman', 'furniture', 260, 780, 1300),
    ('겨울왕국', '썰매'): ('sled', '썰매', 'Sled', 'furniture', 340, 300, 1330),
    ('밸런타인데이', '꽃다발'): ('bouquet', '꽃다발', 'Bouquet', 'furniture', 220, 760, 1300),
    ('밸런타인데이', '초콜릿'): ('chocolate', '초콜릿 상자', 'Chocolates', 'furniture', 280, 300, 1320),
    ('밸런타인데이', '하트쿠션'): ('heart_cushion', '하트 쿠션', 'Heart Cushion', 'furniture', 300, 560, 1340),
    ('봄소풍', '도시락'): ('bento', '도시락', 'Bento', 'furniture', 260, 420, 1310),
    ('봄소풍', '돗자리'): ('picnic_mat', '돗자리', 'Picnic Mat', 'rug', 520, 543, 1360),
    ('봄소풍', '벚꽃'): ('blossom', '벚꽃 가지', 'Cherry Blossom', 'wall', 220, 800, 560),
    ('생일파티', '선물'): ('gift', '선물 상자', 'Gift Box', 'furniture', 240, 300, 1320),
    ('생일파티', '케이크'): ('cake', '케이크', 'Cake', 'furniture', 300, 560, 1330),
    ('생일파티', '파티모자'): ('party_hat', '파티 모자', 'Party Hat', 'furniture', 170, 800, 1320),
    ('생일파티', '풍선'): ('balloons', '풍선', 'Balloons', 'furniture', 210, 900, 1250),
    ('여름휴가', '수영장'): ('pool', '튜브 수영장', 'Kiddie Pool', 'rug', 520, 543, 1360),
    ('여름휴가', '튜브'): ('float', '튜브', 'Swim Ring', 'furniture', 250, 300, 1320),
    ('여름휴가', '파라솔'): ('parasol', '파라솔', 'Parasol', 'furniture', 330, 840, 1280),
    ('크리스마스', '리스'): ('wreath', '리스', 'Wreath', 'wall', 220, 543, 600),
    ('크리스마스', '벽난로'): ('fireplace', '벽난로', 'Fireplace', 'furniture', 440, 330, 1250),
    ('크리스마스', '선물'): ('gift', '선물 상자', 'Gift Box', 'furniture', 230, 760, 1330),
    ('크리스마스', '트리'): ('tree', '트리', 'Tree', 'furniture', 300, 800, 1300),
    ('핼러윈', '마녀모자'): ('witch_hat', '마녀 모자', 'Witch Hat', 'furniture', 250, 300, 1320),
    ('핼러윈', '유령'): ('ghost', '유령', 'Ghost', 'furniture', 230, 780, 1300),
    ('핼러윈', '호박'): ('pumpkin', '호박', 'Pumpkin', 'furniture', 250, 540, 1330),
}
# 소품만 따로 받은 것: 파일 → (이름 id, 한글, 영문, 그룹, 기본 폭, x, y)  (핼러윈에 합친다)
EXTRA = {
    '검은고양이인형': ('black_cat', '검은 고양이 인형', 'Black Cat Doll', 'furniture', 230, 400, 1330),
    '마녀가마솥': ('cauldron', '마녀 가마솥', 'Witch Cauldron', 'furniture', 270, 680, 1320),
    '박쥐장식': ('bat', '박쥐 장식', 'Bat Decor', 'wall', 200, 800, 560),
    '사탕바구니': ('candy_basket', '사탕 바구니', 'Candy Basket', 'furniture', 250, 900, 1320),
}

shutil.rmtree(OUT, ignore_errors=True)
themes, items = [], {}
for folder, (tid, ko, en, icon) in THEMES.items():
    os.makedirs(f'{OUT}/{tid}/items', exist_ok=True)
    shutil.copy(f'{pack}/{folder}/벽지배경.png', f'{OUT}/{tid}/wall.png')
    shutil.copy(f'{pack}/{folder}/바닥.png', f'{OUT}/{tid}/floor.png')
    themes.append({'id': tid, 'ko': ko, 'en': en, 'icon': icon})
for (folder, name), (pid, ko, en, group, bw, x, y) in PROPS.items():
    tid = THEMES[folder][0]
    iid = f'theme_{tid}_{pid}'
    shutil.copy(f'{pack}/{folder}/{name}.png', f'{OUT}/{tid}/items/{iid}.png')
    items[iid] = {'ko': ko, 'en': en, 'theme': tid, 'group': group, 'baseWidth': bw, 'x': x, 'y': y}
if extra:
    tid = 'halloween'
    for name, (pid, ko, en, group, bw, x, y) in EXTRA.items():
        iid = f'theme_{tid}_{pid}'
        shutil.copy(f'{extra}/{name}.png', f'{OUT}/{tid}/items/{iid}.png')
        items[iid] = {'ko': ko, 'en': en, 'theme': tid, 'group': group, 'baseWidth': bw, 'x': x, 'y': y}
json.dump(themes, open('scripts/themes.json', 'w'), ensure_ascii=False, indent=2)
open('scripts/themes.json', 'a').write('\n')
json.dump(items, open('scripts/theme-items.json', 'w'), ensure_ascii=False, indent=2)
open('scripts/theme-items.json', 'a').write('\n')
print(f'테마 {len(themes)}개, 소품 {len(items)}개')
