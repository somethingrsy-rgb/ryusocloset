/** 저장소가 바뀌었다는 신호 (동기화가 켜져 있으면 곧 올린다). 동기화 코드와 저장 코드가 서로를 직접 가져오지 않게 하려는 얇은 연결 */
const listeners = new Set<() => void>()
export const onLocalChange = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))
export const emitLocalChange = () => listeners.forEach((fn) => fn())
