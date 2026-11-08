import { beforeEach, expect, it, vi } from 'vitest'

const transport = vi.hoisted(() => ({
  join: vi.fn(async () => ({ uid: 'host', full: false })),
  openHome: vi.fn<() => Promise<void>>(),
  chat: vi.fn(),
  closeHome: vi.fn(),
  leave: vi.fn(),
  onPlayers: vi.fn(),
  onChat: vi.fn(),
  onBoss: vi.fn(),
  watchHome: vi.fn(() => () => {}),
}))
vi.mock('./config', () => ({ firebaseReady: false, localTest: true }))
vi.mock('./localTransport', () => ({ localTransport: () => transport }))

import { closeHome, getMp, inviteHome, joinMp } from './session'

beforeEach(async () => {
  vi.clearAllMocks()
  await joinMp('Host', { avatar: '', outfit: {} })
})

it('announces an invitation only after the room has been saved', async () => {
  let saved!: () => void
  transport.openHome.mockImplementationOnce(() => new Promise<void>((resolve) => { saved = resolve }))
  const inviting = inviteHome({ scene: 'place', place: 'park' }, 'Come visit')
  expect(transport.chat).not.toHaveBeenCalled()
  saved()
  await expect(inviting).resolves.toBe(true)
  expect(transport.chat).toHaveBeenCalledWith('Host', 'Come visit', true)
})

it('does not send an invitation for a rejected write or after leaving the room', async () => {
  transport.openHome.mockRejectedValueOnce(new Error('write rejected'))
  await expect(inviteHome({ scene: 'place', place: 'park' })).resolves.toBe(false)
  let saved!: () => void
  transport.openHome.mockImplementationOnce(() => new Promise<void>((resolve) => { saved = resolve }))
  const inviting = inviteHome({ scene: 'place', place: 'park' })
  closeHome()
  saved()
  await expect(inviting).resolves.toBe(false)
  expect(transport.chat).not.toHaveBeenCalled()
  expect(getMp().hosting).toBe(false)
})
