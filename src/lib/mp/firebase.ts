/**
 * Firebase 연결(이 파일만 Firebase 를 안다). 웹 앱 설정은 빌드 환경변수(VITE_FIREBASE_*)로 받는다.
 * 설정이 없으면(지금의 GitHub Pages 배포처럼) 멀티플레이어 단추가 숨고 Firebase 코드는 받지도 않는다(동적 import).
 * 서비스 계정 비공개 키는 쓰지 않는다: 브라우저는 익명 로그인 + 데이터베이스 보안 규칙(database.rules.json)으로만 접근한다.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { getDatabase, type Database } from 'firebase/database'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

let app: FirebaseApp | null = null
let db: Database | null = null
let userP: Promise<User> | null = null

/** 익명 로그인한 사용자(처음 한 번만 로그인, 같은 브라우저면 같은 uid 를 다시 쓴다)와 데이터베이스 */
export function connect(): Promise<{ user: User; db: Database }> {
  if (!app) {
    app = initializeApp(firebaseConfig)
    db = getDatabase(app)
  }
  const auth = getAuth(app)
  userP ??= new Promise<User>((resolve, reject) => {
    const off = onAuthStateChanged(auth, (u) => { if (u) { off(); resolve(u) } }, reject)
    signInAnonymously(auth).catch((e) => { off(); userP = null; reject(e) })
  })
  return userP.then((user) => ({ user, db: db! }))
}
