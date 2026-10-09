"""테마 하나를 추가(또는 갱신)한다: 벽지·바닥·소품 PNG 를 assets-src/themes/<id>/ 로 옮기고 scripts/themes.json · scripts/theme-items.json 에 이어 적는다 (다른 테마는 그대로).

사용: python tools-py/add_theme.py <id> <한글> <영문> <아이콘> <벽지.png> <바닥.png> <소품 표.json>
  소품 표: {"파일경로.png": ["이름id","한글","영문","furniture|rug|wall", 기본폭, x, y], ...}
(전체 묶음을 한 번에 넣는 것은 tools-py/import_themes.py)
"""
import json
import os
import shutil
import sys

tid, ko, en, icon, wall, floor, table = sys.argv[1:8]
props = json.load(open(table))
base = f'assets-src/themes/{tid}'
shutil.rmtree(base, ignore_errors=True)
os.makedirs(f'{base}/items')
shutil.copy(wall, f'{base}/wall.png')
shutil.copy(floor, f'{base}/floor.png')

themes = json.load(open('scripts/themes.json'))
themes = [t for t in themes if t['id'] != tid] + [{'id': tid, 'ko': ko, 'en': en, 'icon': icon}]
items = {k: v for k, v in json.load(open('scripts/theme-items.json')).items() if v.get('theme') != tid}
for path, (pid, pko, pen, group, bw, x, y) in props.items():
    iid = f'theme_{tid}_{pid}'
    shutil.copy(path, f'{base}/items/{iid}.png')
    items[iid] = {'ko': pko, 'en': pen, 'theme': tid, 'group': group, 'baseWidth': bw, 'x': x, 'y': y}
for p, d in (('scripts/themes.json', themes), ('scripts/theme-items.json', items)):
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2)
    open(p, 'a').write('\n')
print(tid, len(props), '소품')
