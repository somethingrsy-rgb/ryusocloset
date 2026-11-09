import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AWAY_MS, cleanLobby, shouldNotify, validSubscription } from './policy.mjs'

test('only retained, away participants receive push', () => {
  assert.equal(shouldNotify({ t: 1000, away: true }, 1001), true)
  assert.equal(shouldNotify({ t: 1000 }, 16000), true)
  assert.equal(shouldNotify({ t: 1000 }, 1001), false)
  assert.equal(shouldNotify({ t: 1000, away: true }, 1000 + AWAY_MS), false)
  assert.equal(shouldNotify(null, 1001), false)
})
test('cleanup preserves refreshed members and their homes, removes expired and orphan homes', () => {
  const lobby = { players: { away: { t: 0 }, back: { t: AWAY_MS } }, homes: { away: {}, back: {}, left: {} }, food: { away: {}, back: {}, left: {} } }
  assert.deepEqual(cleanLobby(lobby, AWAY_MS), { players: { back: { t: AWAY_MS } }, homes: { back: {} }, food: { back: {} } })
  assert.equal(cleanLobby(lobby, AWAY_MS + 1), undefined)
})
test('push endpoints cannot target internal hosts, non-HTTPS, redirects or lookalike domains', () => {
  const keys = { auth: 'a'.repeat(22), p256dh: 'b'.repeat(87) }
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.test/x', 'https://fcm.googleapis.com:444/x', 'https://user:password@fcm.googleapis.com/x']) assert.equal(validSubscription({ endpoint, keys }), false)
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/token', 'https://web.push.apple.com/token', 'https://updates.push.services.mozilla.com/wpush/v2/token']) assert.equal(validSubscription({ endpoint, keys }), true)
})
