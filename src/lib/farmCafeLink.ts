/**
 * 3D 농장 ↔ 3D 카페를 잇는 길: 한쪽 길 끝까지 걸어가면 다른 쪽 길 끝에서 도착한다.
 * 화면(탭)을 바꾸기 전에 어디서 왔는지 적어 두고, 새 화면이 처음 그릴 때 보고(isArriving) 다 열리면 지운다(clearArrival).
 * (React 개발 모드는 처음 값을 두 번 계산하므로 보는 것과 지우는 것을 나눴다)
 */
export type Arrival = 'fromFarm' | 'fromCafe'
let pending: Arrival | null = null
export const setArrival = (a: Arrival) => { pending = a }
export const isArriving = (a: Arrival) => pending === a
export const clearArrival = () => { pending = null }
