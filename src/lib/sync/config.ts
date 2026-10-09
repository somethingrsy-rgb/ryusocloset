import raw from '../../data/firebase-config.json'

/** Firebase 웹 앱 설정 (src/data/firebase-config.json). 비어 있으면 동기화 기능은 꺼져 있다. 이 값은 비밀번호가 아니라 공개되어도 되는 접속 주소다. */
export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  storageBucket?: string
  messagingSenderId?: string
}
const c = raw as Partial<FirebaseConfig>
export const firebaseConfig: FirebaseConfig | null = c.apiKey && c.projectId && c.appId && c.authDomain ? (c as FirebaseConfig) : null
export const syncAvailable = firebaseConfig !== null
