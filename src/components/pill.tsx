import type { ReactNode } from 'react'

/**
 * 여행 화면 위쪽의 알약 버튼·표시(거리, 영어, 농장, 별비, 낮/밤)가 모두 같은 모양이 되게 하는 공통 스타일.
 * 버튼에는 전역 `button { font: inherit }` 때문에 글자 크기 클래스가 먹지 않으므로 글자는 안쪽 span 에 건다(PillText).
 */
export const PILL = 'flex h-12 shrink-0 items-center gap-1 rounded-full bg-white/90 px-3 shadow-md ring-1 ring-black/5'
export const PillText = ({ children }: { children: ReactNode }) => <span className="text-sm font-bold">{children}</span>
