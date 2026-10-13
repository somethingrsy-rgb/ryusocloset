import roomItems from '../data/room-items.json'
import campItems from '../data/camp-items.json'
import type { RoomItemDef } from './roomTypes'

/**
 * 여행 장소 안에 미리 놓아 두는 가구. 기본 가구·캠핑 용품만 쓴다.
 * 여행에서 찾는 테마 소품(`theme_*`)은 일부러 넣지 않는다: 그건 찾아서 내 방을 꾸미는 재미로 남겨 둔다.
 * 눌러지지 않는 그림이고, 보낸 방(게임에 보내기)이 있는 장소에서는 그 방이 대신 보인다.
 */
export interface TravelDecor {
  item: RoomItemDef
  x: number
  y: number
  width: number
}
/** [id, 발 아래 가운데 x(%), 바닥 y(%), 너비(% 장면 폭)] */
type Placement = [id: string, x: number, y: number, width: number]
const ITEMS = Object.fromEntries(([...roomItems, ...campItems] as RoomItemDef[]).map((item) => [item.id, item]))

// 비워 둘 곳: 입구(20, 86), 주민(84, 84), 선물 상자(52, 74)
export const LAYOUTS: Record<string, Placement[]> = {
  spring: [
    ['camp_chair', 27, 73, 24],
    ['camp_table', 56, 80, 26],
    ['furniture_succulent_pot', 72, 74, 15],
    ['furniture_plush_bear', 40, 86, 14],
    ['wall_wreath', 50, 44, 18],
  ],
  summer: [
    ['camp_chair', 26, 70, 23],
    ['camp_icebox', 64, 79, 17],
    ['camp_table', 46, 83, 24],
    ['furniture_succulent_pot', 74, 73, 14],
    ['furniture_shopping_bag', 38, 72, 11],
  ],
  camp: [
    ['camp_tent', 32, 72, 38],
    ['camp_table', 61, 70, 25],
    ['camp_chair', 29, 82, 22],
    ['camp_campfire', 64, 82, 21],
    ['camp_lantern', 77, 70, 13],
    ['camp_icebox', 46, 86, 15],
  ],
  birthday: [
    ['rug_stripe', 49, 86, 52],
    ['furniture_sofa_bear', 29, 72, 36],
    ['furniture_heart_cushion', 31, 83, 16],
    ['furniture_plush_bear', 70, 80, 14],
    ['furniture_shoebox', 63, 72, 15],
    ['wall_star_string', 48, 36, 56],
  ],
  halloween: [
    ['furniture_dresser', 28, 74, 20],
    ['furniture_mirror_full', 71, 72, 11],
    ['furniture_hanger', 50, 72, 30],
    ['furniture_shopping_bag', 38, 84, 12],
    ['wall_clock', 50, 42, 15],
    ['light_sparkle', 48, 60, 36],
  ],
  alice: [
    ['rug_stripe', 49, 86, 51],
    ['furniture_desk_chair', 28, 75, 28],
    ['camp_table', 58, 80, 28],
    ['furniture_succulent_pot', 74, 74, 14],
    ['wall_frame', 48, 44, 18],
  ],
  valentine: [
    ['rug_stripe', 49, 86, 52],
    ['furniture_sofa_bear', 31, 73, 38],
    ['furniture_heart_cushion', 33, 84, 17],
    ['furniture_vanity', 72, 73, 20],
    ['furniture_plush_bear', 62, 83, 13],
    ['wall_wreath', 52, 44, 19],
  ],
  palace: [
    ['rug_stripe', 49, 86, 54],
    ['furniture_vanity', 27, 75, 22],
    ['furniture_mirror_full', 72, 72, 12],
    ['furniture_dresser', 45, 74, 17],
    ['furniture_desk_chair', 62, 82, 22],
    ['wall_clock', 48, 42, 15],
    ['wall_frame', 62, 46, 15],
  ],
  christmas: [
    ['rug_stripe', 49, 86, 52],
    ['furniture_xmas_tree_pastel', 71, 73, 20],
    ['furniture_xmas_tree_redwhite', 26, 74, 19],
    ['furniture_sofa_bear', 44, 85, 28],
    ['wall_wreath', 48, 44, 18],
    ['light_lamp_glow', 83, 62, 13],
  ],
  winter: [
    ['furniture_sofa_bear', 30, 74, 34],
    ['camp_campfire', 62, 82, 19],
    ['camp_lantern', 72, 71, 12],
    ['furniture_plush_bear', 42, 86, 13],
    ['furniture_xmas_tree_pastel', 49, 72, 15],
    ['wall_window_night', 47, 44, 20],
  ],
}

export function decorForPlace(placeId: string): TravelDecor[] {
  return (LAYOUTS[placeId] ?? []).flatMap(([id, x, y, width]) => {
    const item = ITEMS[id]
    return item ? [{ item, x, y, width }] : []
  })
}

/** 바닥 깔개·벽 장식은 사람(주민·류소)보다 뒤, 가구는 발 위치(y)가 아래일수록 앞 */
export function decorLayer(decor: TravelDecor): number {
  return decor.item.group === 'rug' ? 2 : decor.item.group === 'wall' ? 3 : Math.round(decor.y)
}
