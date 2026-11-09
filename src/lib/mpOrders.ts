/**
 * 같이 놀기 방 주문: 방 주인이 받은 친구 주문이 어느 주문서 자리(MP_SEAT~)인지 기억한다(이 기기, 주방에 다녀와도 그대로).
 */
import { MP_SEAT } from './kitchen'

export interface MpOrder { seat: number; orderId: string; uid: string; name: string; menu: string }
const KEY = 'ryuso.mp.orders'
let list: MpOrder[] = (() => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.filter((o) => o && typeof o.orderId === 'string' && Number.isInteger(o.seat)) : [] } catch { return [] } })()
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* 이번만 */ } }
export const mpOrders = () => list
export const mpOrderAt = (seat: number) => list.find((o) => o.seat === seat)
/** 빈 자리에 친구 주문을 기억한다(자리 10개가 다 차면 null) */
export function addMpOrder(o: Omit<MpOrder, 'seat'>): MpOrder | null {
  if (list.some((x) => x.orderId === o.orderId)) return null
  const used = new Set(list.map((x) => x.seat))
  for (let k = 0; k < 10; k++) if (!used.has(MP_SEAT + k)) { const n = { ...o, seat: MP_SEAT + k }; list = [...list, n]; save(); return n }
  return null
}
export function removeMpOrder(seat: number) { list = list.filter((o) => o.seat !== seat); save() }
