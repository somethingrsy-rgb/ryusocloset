/**
 * 새 채팅(초대 포함)이 올라오면, 지금 앱에 들어와 있지 않은 알림 켠 친구들에게 푸시 알림을 보낸다.
 * 알림 토큰은 앱이 push/{uid} 에 저장해 둔다(src/lib/push.ts). 서버 코드는 관리자 권한으로 읽으므로 보안 규칙과 무관하다.
 */
const { onValueCreated } = require('firebase-functions/v2/database')
const admin = require('firebase-admin')
admin.initializeApp()

exports.pushChat = onValueCreated({ ref: '/lobby/chat/{id}', region: 'asia-southeast1' }, async (event) => {
  const m = event.data.val()
  if (!m || typeof m.text !== 'string' || typeof m.uid !== 'string') return
  const db = admin.database()
  const [pushSnap, onlineSnap] = await Promise.all([db.ref('push').get(), db.ref('lobby/players').get()])
  const tokens = pushSnap.val() || {}
  const online = onlineSnap.val() || {}
  const kind = m.bub ? '🫧 별 거품 초대' : m.star ? '⭐ 별잡기 초대' : m.jump ? '🎯 점프 초대' : m.race ? '🏎️ 레이스 초대' : m.home ? '💌 집 초대' : ''
  const title = kind ? `${kind} · ${String(m.name || '친구')}` : String(m.name || '친구')
  const sends = Object.entries(tokens)
    .filter(([uid, tok]) => uid !== m.uid && !online[uid] && typeof tok === 'string')
    .map(async ([uid, token]) => {
      try {
        await admin.messaging().send({ token, data: { title, body: String(m.text).slice(0, 80), tag: kind ? 'invite' : 'chat' }, webpush: { headers: { Urgency: 'high', TTL: '3600' } } })
      } catch (e) {
        // 더 이상 쓸 수 없는 토큰(앱 삭제·알림 해제)은 지운다
        if (e && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test(String(e.code || e.message))) await db.ref(`push/${uid}`).remove()
      }
    })
  await Promise.all(sends)
})
