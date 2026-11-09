export const AWAY_MS = 10 * 60 * 1000
export const SILENT_MS = 15 * 1000
export const retained = (player, now) => !!player && Number.isFinite(player.t) && now - player.t < AWAY_MS
export const shouldNotify = (player, now) => retained(player, now) && (player.away === true || now - player.t >= SILENT_MS)

/** Never send an arbitrary URL supplied by a client from the privileged function. */
export function validSubscription(s) {
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 2048 || typeof s.keys?.auth !== 'string' || typeof s.keys?.p256dh !== 'string') return false
  try {
    const url = new URL(s.endpoint)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
      url.hostname === 'fcm.googleapis.com' || url.hostname === 'web.push.apple.com' ||
      url.hostname === 'updates.push.services.mozilla.com' || url.hostname === 'updates-autopush.webpush.mozgcp.net' ||
      /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname)
    ) && /^[\w-]{16,128}$/.test(s.keys.auth) && /^[\w-]{60,256}$/.test(s.keys.p256dh)
  } catch { return false }
}

/** Called inside an RTDB transaction, so a racing reconnect wins if it refreshed its heartbeat. */
export function cleanLobby(lobby, now) {
  if (!lobby) return undefined
  let changed = false
  for (const [uid, player] of Object.entries(lobby.players ?? {})) {
    if (!retained(player, now)) { delete lobby.players[uid]; changed = true }
  }
  for (const uid of Object.keys(lobby.homes ?? {})) {
    if (!lobby.players?.[uid]) { delete lobby.homes[uid]; if (lobby.food) delete lobby.food[uid]; changed = true }
  }
  return changed ? lobby : undefined
}
