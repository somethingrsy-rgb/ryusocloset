import type { ReactNode } from 'react'

/**
 * 여행 화면 위쪽의 알약 버튼·표시(거리, 영어, 농장, 별비, 낮/밤)가 모두 같은 모양이 되게 하는 공통 스타일.
 * 버튼에는 전역 `button { font: inherit }` 때문에 글자 크기 클래스가 먹지 않으므로 글자는 안쪽 span 에 건다(PillText).
 */
export const PILL = 'flex h-12 shrink-0 items-center gap-1 rounded-full bg-white/90 px-3 shadow-md ring-1 ring-black/5'
export const PillText = ({ children }: { children: ReactNode }) => <span className="text-sm font-bold">{children}</span>

/**
 * 친구와 같이 할 수 있는 게임 단추 표시: 분홍 테두리 + 오른쪽 위 작은 👫 배지.
 * (단추 색은 그대로라서 색을 구분하기 어려워도 배지로 알 수 있다)
 */
export const PILL_MULTI = 'relative flex h-12 shrink-0 items-center gap-1 rounded-full bg-gradient-to-b from-white to-[#fff0f5] px-3 shadow-md ring-2 ring-[#ff8fab]'
export const MultiBadge = () => <span aria-hidden className="pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff8fab] px-0.5 text-[11px] leading-none shadow ring-2 ring-white">👫</span>
