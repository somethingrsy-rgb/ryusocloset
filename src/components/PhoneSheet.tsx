import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CALL_ANIMALS, animalByPhone } from '../lib/animalCalls'
import { assetUrl } from '../lib/items'
import { playDial } from '../lib/dialTone'
import { playCloud, playTap } from '../lib/sound'
import { AnimalCall, unlockSpeech } from './AnimalCall'
import type { PhoneTheme } from './phoneTheme'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

/**
 * 카페 휴대폰: 연락처에서 동물을 누르면 번호가 하나씩 눌리며 전화가 걸리고, 번호판에서 직접 번호를 눌러 걸 수도 있다.
 * 번호판 위에는 지금 아바타(옷·머리 그대로)의 얼굴과 상체가 보인다.
 * dial 로 동물을 넘기면(카페에서 동물을 눌렀을 때) 열리자마자 그 동물에게 건다. 통화가 끝나면 휴대폰 첫 화면으로 돌아온다.
 */
export function PhoneSheet({ theme, kid, avatar, muted, dial, onClose }: { theme: PhoneTheme; kid?: string; avatar: ReactNode; muted: boolean; dial: number | null; onClose: () => void }) {
  const [tab, setTab] = useState<'contacts' | 'keypad'>(dial === null ? 'contacts' : 'keypad')
  const [digits, setDigits] = useState('')
  const [calling, setCalling] = useState<number | null>(null)
  const [wrong, setWrong] = useState(false)
  const [auto, setAuto] = useState(false) // 번호가 저절로 눌리는 중
  const timers = useRef<number[]>([])
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => clear, [])

  /** 연락처에서 고르면 번호판에 번호가 하나씩 눌린 뒤 걸린다 */
  const autoDial = (animal: number) => {
    clear()
    unlockSpeech()
    setTab('keypad'); setWrong(false); setDigits(''); setAuto(true)
    const num = CALL_ANIMALS[animal].phone
    ;[...num].forEach((d, k) => timers.current.push(window.setTimeout(() => { if (!muted) playDial(d); setDigits(num.slice(0, k + 1)) }, 350 + k * 260)))
    timers.current.push(window.setTimeout(() => { setAuto(false); setCalling(animal) }, 350 + num.length * 260 + 350))
  }
  useEffect(() => { if (dial !== null) autoDial(dial) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k: string) => {
    if (auto || !k) return
    setWrong(false)
    if (k === '⌫') { playTap(); setDigits((d) => d.slice(0, -1)); return }
    if (!muted) playDial(k)
    setDigits((d) => (d.length >= 8 ? d : d + k))
  }
  const call = () => {
    if (auto || !digits) return
    const animal = animalByPhone(digits)
    if (animal < 0) { if (!muted) playCloud(); setWrong(true); return }
    unlockSpeech()
    setCalling(animal)
  }
  const hangUp = () => { setCalling(null); setDigits(''); setTab('contacts') }

  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 20000); return () => clearInterval(id) }, [])
  const clock = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
  // 연락처는 얼굴만 나온 그림(public/cafe/face), 통화 화면은 몸 전체 그림(public/cafe/call)
  const face = (i: number) => assetUrl(`cafe/face/${CALL_ANIMALS[i].img}.webp`)

  return (
    <div role="dialog" aria-modal aria-label="휴대폰" className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-2" onClick={(e) => { if (e.target === e.currentTarget && calling === null) onClose() }}>
      <div className={`sheet-in relative flex max-w-full flex-col rounded-[2.6rem] p-2.5 shadow-2xl ${theme.bezel}`} style={{ height: 'min(100%, 46rem)', aspectRatio: '9 / 18.5' }}>
        <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.1rem] ${theme.screen}`}>
          {/* 휴대폰 위쪽: 카메라 구멍과 시계·배터리 */}
          <div aria-hidden className="absolute top-2 left-1/2 z-50 h-5 w-20 -translate-x-1/2 rounded-full bg-black/85" />
          <div aria-hidden className={`relative z-[45] flex shrink-0 items-center justify-between px-6 pt-2 text-xs font-bold ${theme.ink}`}><span>{clock}</span><span>📶 🔋</span></div>

          {calling !== null ? (
            <div className="relative min-h-0 flex-1"><AnimalCall animal={calling} kid={kid} muted={muted} theme={theme} onClose={hangUp} /></div>
          ) : (
            <>
              {/* 번호판에서는 닫기 버튼만 위에 띄워서, 그 자리까지 아바타가 크게 보이게 한다 */}
              <div className={`flex shrink-0 items-center justify-between px-4 pt-3 ${tab === 'keypad' ? 'absolute inset-x-0 top-6 z-10' : ''}`}>
                <p className={`m-0 text-lg font-black ${theme.ink}`}>{tab === 'contacts' ? '📒 연락처' : ''}</p>
                <button aria-label="휴대폰 닫기" onClick={onClose} className={`h-9 w-9 rounded-full bg-white/80 text-base font-bold shadow-sm ${theme.ink}`}>✕</button>
              </div>

              {tab === 'contacts' ? (
                <ul className="m-0 mt-2 grid min-h-0 flex-1 list-none grid-cols-2 content-start gap-2.5 overflow-y-auto px-3 pb-3">
                  {CALL_ANIMALS.map((a, i) => (
                    <li key={a.img} className="min-h-0">
                      {/* 한 칸: 위에 동물 얼굴, 그 아래 가운데에 번호, 수화기는 번호 줄의 오른쪽 끝으로 뺀다. 얼굴 그림은 모두 같은 비율이고 동그라미 안쪽 여백까지 그림에 담겨 있다 */}
                      <button aria-label={`${a.name} ${a.phone} 전화 걸기`} onClick={() => autoDial(i)} className="flex w-full flex-col items-center gap-1 rounded-2xl bg-white/85 px-2 pt-2 pb-1.5 shadow-sm active:scale-[0.97]">
                        <span className={`flex aspect-square w-[58%] max-w-24 items-center justify-center rounded-full bg-white ring-2 ${theme.ring}`}><img src={face(i)} alt="" draggable={false} className="h-full w-full object-contain" /></span>
                        <span className="relative flex w-full items-center justify-center">
                          <span className={`text-lg font-bold tracking-widest ${theme.ink}`}>{a.phone}</span>
                          <span aria-hidden className={`absolute right-0 flex h-8 w-8 items-center justify-center rounded-full text-sm text-white ${theme.accent}`}>📞</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-end gap-1 px-3 pt-3 pb-2">
                  {/* 지금 아바타의 머리~어깨: 아바타 그림(1024×1536)의 위쪽 700px 을 폭 전체로 보여 준다.
                      양갈래·땋은 머리처럼 옆으로 넓게 퍼지는 머리카락(그림 폭 거의 끝까지)도 잘리지 않게 폭은 자르지 않는다 */}
                  <div className="flex min-h-0 w-full flex-1 items-end justify-center" style={{ containerType: 'size' }}>
                    <div className="relative overflow-hidden" style={{ width: 'min(100cqw, 100cqh * 1024 / 700)', aspectRatio: '1024 / 700' }}>
                      <div className="absolute inset-x-0 top-0" style={{ aspectRatio: '1024 / 1536' }}>{avatar}</div>
                    </div>
                  </div>
                  <div className="flex min-h-[2.75rem] shrink-0 flex-col items-center justify-center">
                    <p aria-live="polite" className={`m-0 text-4xl font-black tracking-[0.2em] ${theme.ink}`}>{digits || ' '}</p>
                    {wrong ? <p className="m-0 text-sm font-bold text-[#d9534f]">없는 번호예요. 연락처를 볼까요?</p>
                      : auto ? <p className="m-0 text-sm text-black/45">번호를 누르는 중…</p>
                      : <p className="m-0 text-xs text-black/35">번호를 누르고 📞 를 눌러요</p>}
                  </div>
                  <div className="grid w-full max-w-[15rem] shrink-0 grid-cols-3 gap-2">
                    {/* 앱 전체의 button { font: inherit } 가 Tailwind 글자 크기·굵기보다 앞서서, 숫자 크기·굵기는 style 로 준다 */}
                    {KEYS.map((k, i) => k
                      ? <button key={i} aria-label={k === '⌫' ? '지우기' : k} onClick={() => press(k)} className={`aspect-square rounded-full shadow-sm active:scale-90 ${k === '⌫' ? 'bg-transparent shadow-none' : theme.key} ${theme.ink}`} style={{ fontSize: k === '⌫' ? '1.5rem' : '2rem', fontWeight: 800 }}>{k}</button>
                      : <span key={i} />)}
                  </div>
                  <button aria-label="전화 걸기" onClick={call} disabled={!digits || auto} className="mt-1 h-14 w-14 shrink-0 rounded-full bg-[#34c759] text-2xl text-white shadow active:scale-90 disabled:opacity-40">📞</button>
                </div>
              )}

              {/* 아래 칸: 연락처 ↔ 번호판 */}
              <div className="flex shrink-0 gap-1 border-t border-black/5 bg-white/70 p-1.5">
                {(['contacts', 'keypad'] as const).map((t) => (
                  <button key={t} aria-pressed={tab === t} onClick={() => { if (auto) return; playTap(); setTab(t); setWrong(false) }} className={`min-h-11 flex-1 rounded-2xl text-sm font-bold ${tab === t ? `${theme.accent} text-white` : theme.ink}`}>{t === 'contacts' ? '📒 연락처' : '🔢 번호판'}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
