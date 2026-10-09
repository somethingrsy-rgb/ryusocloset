/** Firebase(로그인 + Firestore) 연결. 설정이 있을 때만 불러온다(dynamic import)라서 꺼져 있으면 앱 크기에 영향이 없다. */
import type { Item } from '../types'
import type { RoomItemDef } from '../roomTypes'
import { firebaseConfig } from './config'
import type { CustomRemote, Remote } from './core'

type Fb = {
  app: import('firebase/app').FirebaseApp
  auth: import('firebase/auth').Auth
  db: import('firebase/firestore').Firestore
  A: typeof import('firebase/auth')
  F: typeof import('firebase/firestore')
}
let fb: Promise<Fb> | null = null

export function load(): Promise<Fb> {
  if (!firebaseConfig) return Promise.reject(new Error('not-configured'))
  fb ??= (async () => {
    const [{ initializeApp }, A, F] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
    const app = initializeApp(firebaseConfig)
    return { app, auth: A.getAuth(app), db: F.getFirestore(app), A, F }
  })()
  return fb
}

export const currentUser = async () => {
  const { auth } = await load()
  await auth.authStateReady()
  return auth.currentUser
}

export async function watchUser(cb: (email: string | null, uid: string | null) => void): Promise<() => void> {
  const { auth, A } = await load()
  return A.onAuthStateChanged(auth, (u) => cb(u?.email ?? null, u?.uid ?? null))
}

export async function signIn(email: string, password: string) {
  const { auth, A } = await load()
  await A.signInWithEmailAndPassword(auth, email, password)
}
export async function signUp(email: string, password: string) {
  const { auth, A } = await load()
  await A.createUserWithEmailAndPassword(auth, email, password)
}
export async function signOutUser() {
  const { auth, A } = await load()
  await A.signOut(auth)
}

/** 오류 코드를 사람이 읽을 문장 열쇠로 */
export function authErrorKey(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'syncErrCred'
  if (code.includes('email-already-in-use')) return 'syncErrExists'
  if (code.includes('weak-password')) return 'syncErrWeak'
  if (code.includes('invalid-email')) return 'syncErrEmail'
  if (code.includes('network')) return 'syncErrNetwork'
  if (code.includes('operation-not-allowed') || code.includes('configuration-not-found')) return 'syncErrSetup'
  return 'syncErrGeneric'
}

const kvCol = (f: Fb, uid: string) => f.F.collection(f.db, 'users', uid, 'kv')
const customCol = (f: Fb, uid: string, c: 'items' | 'roomItems') => f.F.collection(f.db, 'users', uid, c)
/** 문서 id 에는 '/' 를 못 쓰므로 키의 점은 그대로 두고 슬래시만 바꾼다 (우리 키에는 슬래시가 없다) */
const docId = (key: string) => key.replace(/\//g, '_')

export async function fetchKv(uid: string): Promise<Record<string, Remote>> {
  const f = await load()
  const snap = await f.F.getDocs(kvCol(f, uid))
  const out: Record<string, Remote> = {}
  snap.forEach((d) => {
    const x = d.data() as { key?: string; v?: string; t?: number }
    if (typeof x.key === 'string' && typeof x.v === 'string' && typeof x.t === 'number') out[x.key] = { v: x.v, t: x.t }
  })
  return out
}
export async function putKv(uid: string, key: string, v: string, t: number) {
  const f = await load()
  await f.F.setDoc(f.F.doc(kvCol(f, uid), docId(key)), { key, v, t })
}

export async function fetchCustomIndex(uid: string, c: 'items' | 'roomItems'): Promise<CustomRemote[]> {
  const f = await load()
  const snap = await f.F.getDocs(customCol(f, uid, c))
  return snap.docs.map((d) => ({ id: d.id, del: (d.data() as { del?: boolean }).del === true }))
}
export async function fetchCustomOne<T extends Item | RoomItemDef>(uid: string, c: 'items' | 'roomItems', id: string): Promise<T | null> {
  const f = await load()
  const d = await f.F.getDoc(f.F.doc(customCol(f, uid, c), id))
  const json = (d.data() as { json?: string } | undefined)?.json
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
/** 한 문서 1MB 한도 때문에 너무 큰 그림은 false */
export async function putCustom(uid: string, c: 'items' | 'roomItems', id: string, data: Item | RoomItemDef): Promise<boolean> {
  const json = JSON.stringify(data)
  if (json.length > 900_000) return false
  const f = await load()
  await f.F.setDoc(f.F.doc(customCol(f, uid, c), id), { json, t: Date.now() })
  return true
}
export async function putTombstone(uid: string, c: 'items' | 'roomItems', id: string) {
  const f = await load()
  await f.F.setDoc(f.F.doc(customCol(f, uid, c), id), { del: true, t: Date.now() })
}
