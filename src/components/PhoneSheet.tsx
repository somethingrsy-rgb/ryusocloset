import { useEffect, useRef, useState } from 'react'
import { CALL_ANIMALS, animalByPhone } from '../lib/animalCalls'
import { assetUrl } from '../lib/items'
import { playDial } from '../lib/dialTone'
import { playCloud, playTap } from '../lib/sound'
import { AnimalCall, unlockSpeech } from './AnimalCall'
import type { PhoneTheme } from './phoneTheme'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

/**
 * 카페 휴대폰: 연락처에서 동물을 누르면 번호가 하나씩 눌리며 전화가 걸리고, 번호판에서 직접 번호를 눌러 걸 수도 있다.
 * dial 로 동물을 넘기면(카페에서 동물을 눌렀을 때) 열리자마자 그 동물에게 건다. 통화가 끝나면 휴대폰 첫 화면으로 돌아온다.
 */
export function PhoneSheet({ theme, kid, muted, dial, onClose }: { theme: PhoneTheme; kid?: string; muted: boolean; dial: number | null; onClose: () => void }) {
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
              <div className="flex shrink-0 items-center justify-between px-4 pt-3">
                <p className={`m-0 text-lg font-black ${theme.ink}`}>{tab === 'contacts' ? '📒 연락처' : '☎️ 전화 걸기'}</p>
                <button aria-label="휴대폰 닫기" onClick={onClose} className={`h-9 w-9 rounded-full bg-white/80 text-base font-bold shadow-sm ${theme.ink}`}>✕</button>
              </div>

              {tab === 'contacts' ? (
                <ul className="m-0 mt-2 grid min-h-0 flex-1 list-none grid-cols-2 content-start gap-2.5 overflow-y-auto px-3 pb-3">
                  {CALL_ANIMALS.map((a, i) => (
                    <li key={a.img} className="min-h-0">
                      {/* 한 칸: 동물 얼굴과 번호를 나란히, 수화기는 오른쪽 옆에 살짝 기울여서. 얼굴 그림은 모두 같은 비율이라(토끼 기준) 동그라미 안에 들어온다 */}
                      <button aria-label={`${a.name} ${a.phone} 전화 걸기`} onClick={() => autoDial(i)} className="relative flex h-full w-full items-center justify-center gap-1.5 rounded-2xl bg-white/85 py-3 pr-7 pl-1 shadow-sm active:scale-[0.97]">
                        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white ring-2 ${theme.ring}`}><img src={face(i)} alt="" draggable={false} className="h-[84%] w-[84%] object-contain" /></span>
                        <span className={`text-base font-bold tracking-wider ${theme.ink}`}>{a.phone}</span>
                        <span aria-hidden className={`absolute top-1/2 -right-2 flex h-9 w-9 -translate-y-1/2 rotate-[20deg] items-center justify-center rounded-full text-base text-white shadow ${theme.accent}`}>📞</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-end gap-2 px-5 pb-2">
                  <div className="flex min-h-[4.5rem] flex-col items-center justify-center">
                    <p aria-live="polite" className={`m-0 text-4xl font-black tracking-[0.2em] ${theme.ink}`}>{digits || ' '}</p>
                    {wrong ? <p className="m-0 text-sm font-bold text-[#d9534f]">없는 번호예요. 연락처를 볼까요?</p>
                      : auto ? <p className="m-0 text-sm text-black/45">번호를 누르는 중…</p>
                      : <p className="m-0 text-xs text-black/35">번호를 누르고 📞 를 눌러요</p>}
                  </div>
                  <div className="grid w-full max-w-[15rem] grid-cols-3 gap-2">
                    {KEYS.map((k, i) => k
                      ? <button key={i} aria-label={k === '⌫' ? '지우기' : k} onClick={() => press(k)} className={`aspect-square rounded-full text-2xl font-bold shadow-sm active:scale-90 ${k === '⌫' ? 'bg-transparent text-xl shadow-none' : theme.key} ${theme.ink}`}>{k}</button>
                      : <span key={i} />)}
                  </div>
                  <button aria-label="전화 걸기" onClick={call} disabled={!digits || auto} className="mt-1 h-14 w-14 rounded-full bg-[#34c759] text-2xl text-white shadow active:scale-90 disabled:opacity-40">📞</button>
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
