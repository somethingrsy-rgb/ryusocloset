/**
 * 게임 초대 전달(레이스·점프 공용): 친구가 보낸 초대를 수락하면 여기에 방 번호를 담아 두고,
 * 게임 탭의 그 게임 화면이 열리면서 그 방으로 바로 들어간다. 이미 열려 있으면 이벤트로 알려 준다.
 */
export const RACE_INVITE_EVENT = 'ryuso:race-invite'
export type InviteGame = 'race' | 'jump' | 'star'
let pending: { game: InviteGame; room: string; from: string } | null = null
function set(game: InviteGame, room: string, from: string) {
  pending = { game, room, from }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(RACE_INVITE_EVENT, { detail: game }))
}
export const setRaceInvite = (room: string, from: string) => set('race', room, from)
export const setJumpInvite = (room: string, from: string) => set('jump', room, from)
export const setStarInvite = (room: string, from: string) => set('star', room, from)
export const hasStarInvite = () => pending?.game === 'star'
export const takeStarInvite = () => take('star')
export const hasRaceInvite = () => pending?.game === 'race'
export const hasJumpInvite = () => pending?.game === 'jump'
/** 담아 둔 초대를 꺼낸다(한 번만). 다른 게임의 초대는 건드리지 않는다 */
function take(game: InviteGame) { if (pending?.game !== game) return null; const p = pending; pending = null; return p }
export const takeRaceInvite = () => take('race')
export const takeJumpInvite = () => take('jump')
