import { initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { onValueCreated, onValueDeleted } from 'firebase-functions/v2/database'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret, defineString } from 'firebase-functions/params'
import { warn } from 'firebase-functions/logger'
import webpush from 'web-push'
import { cleanLobby, retained, shouldNotify, validSubscription } from './policy.mjs'
import { dbConfig } from './config.mjs'

// 실제 프로젝트 ryuso-game: asia-southeast1 의 ryuso-game-default-rtdb (config.mjs, .env.ryuso-game 으로 바꿀 수 있다)
const { region, instance, databaseUrl } = dbConfig()
initializeApp({ databaseURL: databaseUrl })
const publicKey = defineString('WEB_PUSH_PUBLIC_KEY')
const subject = defineString('WEB_PUSH_SUBJECT', { description: 'A contact mailto: address or HTTPS URL' })
const privateKey = defineSecret('WEB_PUSH_PRIVATE_KEY')

export const notifyChat = onValueCreated({ ref: '/lobby/chat/{messageId}', region, instance, secrets: [privateKey], retry: false }, async event => {
  const message = event.data.val()
  const now = Date.now()
  if (typeof message?.uid !== 'string' || typeof message.text !== 'string' || typeof message.t !== 'number' || now - message.t > 60000) return
  const root = event.data.ref.root
  const players = (await root.child('lobby/players').get()).val() ?? {}
  if (!retained(players[message.uid], now)) return
  const recipients = Object.entries(players).filter(([uid, player]) => uid !== message.uid && (!message.call || message.call === uid) && shouldNotify(player, now))
  await Promise.all(recipients.map(async ([uid]) => {
    const subscriptions = (await root.child(`pushSubscriptions/${uid}`).get()).val() ?? {}
    const valid = Object.entries(subscriptions).filter(([, s]) => validSubscription(s)).slice(0, 5)
    if (!valid.length) return
    // At most one notification per recipient per 30 seconds, also deduplicates event redelivery.
    const claim = await root.child(`pushDelivery/${uid}`).transaction(last => !last || now - last.at >= 30000 ? { at: now, messageId: event.params.messageId } : undefined)
    if (!claim.committed) return
    const current = (await root.child(`lobby/players/${uid}`).get()).val()
    if (!shouldNotify(current, Date.now())) return
    const sender = String(players[message.uid].name || '친구').slice(0, 12)
    const payload = JSON.stringify({ title: message.call ? `${sender}님이 불러요 🔔` : `${sender}님의 새 이야기`, body: message.text.slice(0, 80) })
    await Promise.all(valid.map(async ([key, subscription]) => {
      try {
        await webpush.sendNotification(subscription, payload, {
          TTL: 60, timeout: 10000,
          vapidDetails: { subject: subject.value(), publicKey: publicKey.value(), privateKey: privateKey.value() },
        })
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) await root.child(`pushSubscriptions/${uid}/${key}`).remove()
        else warn('Web push delivery failed', { status: error.statusCode ?? 'network' })
      }
    }))
  }))
})

// Physical cleanup may run up to one minute after expiry; clients hide expired players at ten minutes.
export const expireAwayPlayers = onSchedule({ schedule: 'every 1 minutes', region }, async () => {
  const lobby = getDatabase().ref('lobby')
  await lobby.transaction(current => cleanLobby(current, Date.now()))
})

export const closeLeftHome = onValueDeleted({ ref: '/lobby/players/{uid}', region, instance }, async event => {
  const uid = event.params.uid
  // The membership and home are checked together, so a new join cannot lose its newly opened home.
  await event.data.ref.root.child('lobby').transaction(lobby => {
    if (!lobby || lobby.players?.[uid] || !lobby.homes?.[uid]) return undefined
    delete lobby.homes[uid]
    if (lobby.food) delete lobby.food[uid]
    return lobby
  })
})
