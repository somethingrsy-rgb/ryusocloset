/**
 * 레이스 초대 전달: 친구가 보낸 「자동차 레이스 같이할래?」를 수락하면 여기에 방 번호를 담아 두고,
 * 게임 탭의 레이스 화면(RaceGame)이 열리면서 그 방으로 바로 들어간다. 이미 열려 있으면 이벤트로 알려 준다.
 */
export const RACE_INVITE_EVENT = 'ryuso:race-invite'
let pending: { room: string; from: string } | null = null
export function setRaceInvite(room: string, from: string) {
  pending = { room, from }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(RACE_INVITE_EVENT))
}
export const hasRaceInvite = () => pending !== null
/** 담아 둔 초대를 꺼낸다(한 번만) */
export function takeRaceInvite() { const p = pending; pending = null; return p }
