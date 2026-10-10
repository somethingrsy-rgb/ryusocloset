import roomItems from '../data/room-items.json'
import themeItems from '../data/theme-items.json'
import campItems from '../data/camp-items.json'
import type { RoomItemDef } from './roomTypes'

export type DecorAction = 'look' | 'water' | 'light' | 'rest' | 'tea'
export interface TravelDecor {
  item: RoomItemDef
  x: number
  y: number
  width: number
  action: DecorAction
}
type Placement = [id: string, x: number, y: number, width: number, action?: DecorAction]
const ITEMS = Object.fromEntries(
  ([...roomItems, ...themeItems, ...campItems] as RoomItemDef[]).map((item) => [item.id, item]),
)

// Keep the entrance (20, 86), resident (84, 84), and gift (52, 74) clear.
const LAYOUTS: Record<string, Placement[]> = {
  spring: [
    ['theme_spring_picnic_mat', 48, 82, 48],
    ['theme_spring_bento', 43, 78, 17, 'tea'],
    ['theme_spring_blossom', 77, 47, 19],
    ['camp_chair', 27, 73, 24, 'rest'],
    ['furniture_succulent_pot', 73, 75, 16, 'water'],
  ],
  summer: [
    ['theme_summer_pool', 45, 82, 46],
    ['theme_summer_parasol', 73, 70, 30],
    ['theme_summer_float', 34, 76, 20],
    ['camp_chair', 25, 69, 23, 'rest'],
    ['camp_icebox', 65, 79, 17, 'tea'],
  ],
  camp: [
    ['camp_tent', 32, 72, 38],
    ['camp_table', 61, 70, 25, 'tea'],
    ['camp_chair', 29, 80, 22, 'rest'],
    ['camp_campfire', 64, 81, 21, 'light'],
    ['camp_lantern', 76, 70, 13, 'light'],
  ],
  birthday: [
    ['rug_stripe', 49, 83, 52],
    ['furniture_sofa_bear', 30, 71, 36, 'rest'],
    ['theme_birthday_cake', 60, 72, 24, 'tea'],
    ['theme_birthday_balloons', 76, 68, 20],
    ['theme_birthday_gift', 70, 80, 17],
    ['wall_star_string', 48, 34, 56, 'light'],
  ],
  halloween: [
    ['theme_halloween_bat', 47, 39, 26],
    ['theme_halloween_cauldron', 35, 74, 27, 'tea'],
    ['theme_halloween_pumpkin', 67, 74, 23, 'light'],
    ['theme_halloween_black_cat', 71, 81, 16],
    ['theme_halloween_witch_hat', 27, 81, 17],
  ],
  alice: [
    ['rug_stripe', 49, 84, 51],
    ['theme_alice_queen_chair', 29, 74, 27, 'rest'],
    ['theme_alice_tea_table', 58, 76, 34, 'tea'],
    ['theme_alice_pocket_watch', 50, 43, 17],
    ['theme_alice_mushroom', 74, 71, 21],
  ],
  valentine: [
    ['rug_stripe', 49, 83, 52],
    ['furniture_sofa_bear', 32, 72, 38, 'rest'],
    ['theme_valentine_bouquet', 72, 72, 20, 'water'],
    ['theme_valentine_chocolate', 60, 77, 22, 'tea'],
    ['theme_valentine_heart_cushion', 32, 81, 18],
    ['wall_wreath', 52, 43, 19],
  ],
  palace: [
    ['rug_stripe', 49, 84, 54],
    ['theme_palace_ribbon_chair', 29, 75, 26, 'rest'],
    ['theme_palace_tea_table', 58, 76, 33, 'tea'],
    ['theme_palace_mirror', 74, 68, 20],
    ['theme_palace_rose_vase', 73, 80, 17, 'water'],
    ['wall_clock', 48, 42, 15],
  ],
  christmas: [
    ['rug_stripe', 49, 84, 52],
    ['theme_christmas_fireplace', 31, 74, 37, 'light'],
    ['theme_christmas_tree', 72, 72, 27, 'light'],
    ['theme_christmas_gift', 68, 82, 18],
    ['furniture_sofa_bear', 32, 82, 32, 'rest'],
    ['theme_christmas_wreath', 48, 43, 19],
  ],
  winter: [
    ['theme_winter_sled', 33, 76, 30, 'rest'],
    ['theme_winter_snowman', 71, 74, 26],
    ['theme_winter_snowflake', 48, 39, 18],
    ['camp_lantern', 65, 81, 13, 'light'],
    ['furniture_plush_bear', 29, 82, 15],
  ],
}

export function decorForPlace(placeId: string): TravelDecor[] {
  return (LAYOUTS[placeId] ?? []).flatMap(([id, x, y, width, action = 'look']) => {
    const item = ITEMS[id]
    return item ? [{ item, x, y, width, action }] : []
  })
}

export function decorLayer(decor: TravelDecor): number {
  return decor.item.group === 'rug' ? 2 : decor.item.group === 'wall' ? 3 : Math.round(decor.y)
}
