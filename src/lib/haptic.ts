/**
 * 짧은 진동(손에 톡 오는 느낌).
 * - 안드로이드 등: navigator.vibrate
 * - 아이폰·아이패드(iOS 18 이상 Safari·홈 화면 앱): vibrate 가 없어서, 숨긴 "스위치" 체크박스를 눌러 시스템 햅틱을 낸다.
 *   버튼을 누르는 순간(사용자 동작 안)에 불러야 한다. iOS 17 이하나 진동을 끈 기기에서는 아무 일도 없다
 */
let label: HTMLLabelElement | null = null
function iosSwitch(): HTMLLabelElement | null {
  if (typeof document === 'undefined') return null
  if (label) return label
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.id = 'ryuso-haptic'
  input.tabIndex = -1
  input.setAttribute('aria-hidden', 'true')
  label = document.createElement('label')
  label.htmlFor = input.id
  label.setAttribute('aria-hidden', 'true')
  for (const el of [input, label]) Object.assign(el.style, { position: 'fixed', left: '-9999px', top: '0', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' })
  document.body.append(input, label)
  return label
}

export function haptic(strong = false) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') { navigator.vibrate(strong ? [30, 40, 30] : 18); return }
    const l = iosSwitch()
    l?.click()
    if (strong) window.setTimeout(() => l?.click(), 70)
  } catch { /* 진동을 못 해도 게임은 그대로 */ }
}
