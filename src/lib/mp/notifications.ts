import { connect } from './firebase'
import { ref, remove, serverTimestamp, set } from 'firebase/database'

const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined
export function notificationHint(): string | null {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (ios && !matchMedia('(display-mode: standalone)').matches && !(navigator as Navigator & { standalone?: boolean }).standalone) return '아이폰·아이패드는 공유 메뉴에서 홈 화면에 추가한 뒤 알림을 켜 주세요.'
  if (!isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return '이 브라우저에서는 알림을 사용할 수 없어요.'
  if (!publicKey) return '알림 기능을 준비 중이에요.'
  if (Notification.permission === 'denied') return '브라우저 설정에서 알림을 허용해 주세요.'
  return null
}
async function registration() {
  const ready = await navigator.serviceWorker.getRegistration()
  if (!ready?.active) throw new Error('앱 설치가 끝난 뒤 다시 눌러 주세요.')
  return ready
}
async function subscriptionId(endpoint: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('')
}
export async function enableNotifications() {
  const hint = notificationHint()
  if (hint) throw new Error(hint)
  // Called directly from the button gesture, before any network request (required on iOS).
  if (await Notification.requestPermission() !== 'granted') throw new Error('알림을 허용해야 친구가 부를 때 받을 수 있어요.')
  const worker = await registration()
  const key = Uint8Array.from(atob(publicKey!.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const subscription = await worker.pushManager.getSubscription() ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const { user, db } = await connect()
  await set(ref(db, `pushSubscriptions/${user.uid}/${await subscriptionId(subscription.endpoint)}`), { ...subscription.toJSON(), updatedAt: serverTimestamp() })
}
export async function disableNotifications() {
  const subscription = await (await registration()).pushManager.getSubscription()
  if (!subscription) return
  const { user, db } = await connect()
  await remove(ref(db, `pushSubscriptions/${user.uid}/${await subscriptionId(subscription.endpoint)}`))
  await subscription.unsubscribe()
}
export async function notificationsEnabled() {
  if (notificationHint()) return false
  const subscription = await (await registration()).pushManager.getSubscription()
  return !!subscription
}
