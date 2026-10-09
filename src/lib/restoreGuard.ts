/** 백업을 불러오는 동안에는 앱이 들고 있던 예전 상태가 저장소를 덮어쓰지 못하게 막는다 (불러온 뒤 화면을 다시 불러온다) */
let restoring = false
export const beginRestore = () => {
  restoring = true
}
export const isRestoring = () => restoring
export const endRestore = () => {
  restoring = false
}
