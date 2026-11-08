/** 멀티플레이어를 켤 수 있는지(Firebase 웹 앱 설정이 빌드에 들어 있는지). 이 파일은 Firebase 를 불러오지 않는다 */
export const firebaseReady = !!(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_DATABASE_URL && import.meta.env.VITE_FIREBASE_PROJECT_ID)
/** 같은 브라우저의 탭끼리만 연결하는 시험용(주소에 ?mp=local): Firebase 없이 화면 확인용 */
export const localTest = typeof location !== 'undefined' && new URLSearchParams(location.search).get('mp') === 'local'
export const multiplayerAvailable = firebaseReady || localTest
