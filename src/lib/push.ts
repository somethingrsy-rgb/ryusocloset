/**
 * 앱을 꺼도 오는 알림(채팅·게임 초대): 브라우저 알림 권한 + Firebase Cloud Messaging 토큰을 만들어
 * 데이터베이스 push/{uid} 에 저장해 두면, 서버 함수(functions/index.js)가 새 채팅이 올 때 그 토큰으로 알림을 보낸다.
 * 알림을 화면에 띄우는 것은 서비스 워커(public/push-sw.js). Firebase 설정·푸시 키(VITE_FIREBASE_VAPID_KEY)가 없으면 이 기능은 숨는다.
 */
import { firebaseReady } from './mp/config'

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
const KEY = 'ryuso.push'

export const pushPossible = () =>
  firebaseReady && !!VAPID && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window
export const pushWanted = () => { try { return localStorage.getItem(KEY) === '1' && Notification.permission === 'granted' } catch { return false } }

export type PushResult = 'ok' | 'denied' | 'unsupported' | 'error'

/** 알림 켜기(권한을 묻고 토큰을 저장한다). 이미 켜 둔 사람은 들어갈 때 조용히 토큰을 새로 저장한다 */
export async function enablePush(ask = true): Promise<PushResult> {
  if (!pushPossible()) return 'unsupported'
  try {
    if (Notification.permission === 'default' && ask) await Notification.requestPermission()
    if (Notification.permission !== 'granted') return 'denied'
    const [{ connect }, { getMessaging, getToken, isSupported }, { ref, set }] = await Promise.all([import('./mp/firebase'), import('firebase/messaging'), import('firebase/database')])
    if (!(await isSupported())) return 'unsupported'
    const { user, db } = await connect()
    const { getApp } = await import('firebase/app')
    const reg = await navigator.serviceWorker.ready
    const token = await getToken(getMessaging(getApp()), { vapidKey: VAPID, serviceWorkerRegistration: reg })
    if (!token) return 'error'
    await set(ref(db, `push/${user.uid}`), token)
    try { localStorage.setItem(KEY, '1') } catch { /* 이번만 */ }
    return 'ok'
  } catch { return 'error' }
}

export async function disablePush() {
  try { localStorage.removeItem(KEY) } catch { /* 이번만 */ }
  try {
    const [{ connect }, { ref, remove }] = await Promise.all([import('./mp/firebase'), import('firebase/database')])
    const { user, db } = await connect()
    await remove(ref(db, `push/${user.uid}`))
  } catch { /* 서버에 못 지워도 이 기기는 이미 끔 */ }
}
