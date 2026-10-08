import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackgroundPicker } from './components/BackgroundPicker'
import { Closet } from './components/Closet'
import { ExportSheet } from './components/ExportSheet'
import { SavedSheet } from './components/SavedSheet'
import { Stage } from './components/Stage'
import { Toast } from './components/Toast'
import { I18nContext, detectLang, makeT, type Lang } from './i18n'
import { BACKGROUNDS, DEFAULT_BG_ID, bgById } from './lib/backgrounds'
import { loadImage, renderThumb } from './lib/exportPng'
import { BASE_LAYERS, ITEMS, ITEMS_BY_CATEGORY, assetUrl } from './lib/items'
import type { Category } from './lib/layers'
import { randomOutfit, toggleItem } from './lib/outfit'
import { playSnap } from './lib/sound'
import {
  MAX_SAVED,
  loadCurrent,
  loadSaved,
  loadSettings,
  persistCurrent,
  persistSaved,
  persistSettings,
} from './lib/storage'
import type { Item, Outfit, SavedOutfit } from './lib/types'

type ModalKind = null | 'bg' | 'saved' | 'export'

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function App() {
  const initial = useMemo(loadSettings, [])
  const [lang, setLang] = useState<Lang>(initial.lang ?? detectLang())
  const [sound, setSound] = useState(initial.sound ?? true)
  const [bgId, setBgId] = useState(
    initial.bgId && BACKGROUNDS.some((b) => b.id === initial.bgId) ? initial.bgId : DEFAULT_BG_ID,
  )
  const [outfit, setOutfit] = useState<Outfit>(loadCurrent)
  const [category, setCategory] = useState<Category>('top')
  const [saved, setSaved] = useState<SavedOutfit[]>(loadSaved)
  const [modal, setModal] = useState<ModalKind>(null)
  const [toast, setToast] = useState<string | null>(null)
  const figureRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const i18n = useMemo(() => ({ lang, t: makeT(lang) }), [lang])
  const { t } = i18n
  const bg = bgById(bgId)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = lang === 'ko' ? '류소 옷장' : "Ryuso's Closet"
  }, [lang])
  useEffect(() => void persistSettings({ lang, sound, bgId }), [lang, sound, bgId])
  useEffect(() => void persistCurrent(outfit), [outfit])

  // 착용 순간 깜빡임이 없도록 모든 레이어를 한가할 때 미리 받아 둔다
  useEffect(() => {
    const urls = [...Object.values(BASE_LAYERS), ...ITEMS.map((i) => assetUrl(i.image))]
    const run = () => urls.forEach((u) => void loadImage(u).catch(() => undefined))
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(run)
    else window.setTimeout(run, 400)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1800)
  }, [])

  const snap = useCallback(() => {
    if (sound) playSnap()
    if (!prefersReducedMotion()) {
      figureRef.current?.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.025) rotate(-0.6deg)', offset: 0.4 },
          { transform: 'scale(1)' },
        ],
        { duration: 260, easing: 'ease-out' },
      )
    }
  }, [sound])

  const onToggle = (item: Item) => {
    const next = toggleItem(outfit, item)
    setOutfit(next)
    if (next[item.category] === item.id) snap()
  }

  const onRandom = () => {
    setOutfit(randomOutfit(ITEMS_BY_CATEGORY))
    snap()
  }

  const hasClothes = Object.keys(outfit).length > 0

  const saveCurrent = async () => {
    if (!hasClothes) return showToast(t('nothingToSave'))
    if (saved.length >= MAX_SAVED) return showToast(t('savedFull', { n: MAX_SAVED }))
    try {
      const thumb = await renderThumb(outfit, bg)
      const entry: SavedOutfit = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        createdAt: Date.now(),
        outfit,
        bgId,
        thumb,
      }
      const next = [entry, ...saved]
      if (!persistSaved(next)) return showToast(t('saveFailed'))
      setSaved(next)
      showToast(t('saved'))
    } catch {
      showToast(t('exportFailed'))
    }
  }

  const deleteSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id)
    setSaved(next)
    persistSaved(next)
  }

  const loadOutfit = (s: SavedOutfit) => {
    setOutfit(s.outfit)
    if (BACKGROUNDS.some((b) => b.id === s.bgId)) setBgId(s.bgId)
    snap()
    showToast(t('loaded'))
  }

  const fab = (label: string, icon: string, onClick: () => void, badge?: number) => (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-xl shadow-md ring-1 ring-black/5 backdrop-blur transition active:scale-90"
    >
      <span aria-hidden>{icon}</span>
      {!!badge && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blush px-1 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  )

  return (
    <I18nContext.Provider value={i18n}>
      <div className="mx-auto flex h-dvh max-w-[1100px] flex-col gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:flex-row md:gap-4 md:p-4">
        <section className="flex min-h-0 flex-1 flex-col gap-2">
          <header className="flex shrink-0 items-center justify-between px-1">
            <h1 className="text-xl font-extrabold tracking-tight text-blush-deep">
              <span aria-hidden>🪄 </span>
              {t('title')}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSound((s) => !s)}
                aria-label={sound ? t('soundOff') : t('soundOn')}
                aria-pressed={sound}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-lg shadow-sm"
              >
                <span aria-hidden>{sound ? '🔊' : '🔇'}</span>
              </button>
              <button
                onClick={() => setLang((l) => (l === 'ko' ? 'en' : 'ko'))}
                className="min-h-11 rounded-full bg-white/80 px-4 text-sm font-bold shadow-sm"
              >
                {t('language')}
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            <Stage outfit={outfit} bg={bg} figureRef={figureRef}>
              <div className="absolute top-2 right-2 flex flex-col gap-2">
                {fab(t('random'), '🎲', onRandom)}
                {fab(t('reset'), '🧺', () => setOutfit({}))}
                {fab(t('background'), '🖼️', () => setModal('bg'))}
                {fab(t('saveOutfit'), '💾', saveCurrent)}
                {fab(t('myOutfits'), '📒', () => setModal('saved'), saved.length)}
                {fab(t('exportImage'), '📷', () => (hasClothes ? setModal('export') : showToast(t('nothingToSave'))))}
              </div>
            </Stage>
          </div>
        </section>

        <aside className="flex h-[40dvh] shrink-0 flex-col overflow-hidden rounded-3xl bg-white/90 shadow-lg ring-1 ring-black/5 md:h-auto md:w-[400px]">
          <Closet category={category} onCategory={setCategory} outfit={outfit} onToggle={onToggle} />
        </aside>
      </div>

      {modal === 'bg' && <BackgroundPicker value={bgId} onPick={setBgId} onClose={() => setModal(null)} />}
      {modal === 'saved' && (
        <SavedSheet
          list={saved}
          onLoad={loadOutfit}
          onDelete={deleteSaved}
          onSaveCurrent={saveCurrent}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'export' && (
        <ExportSheet
          outfit={outfit}
          background={bg}
          onClose={() => setModal(null)}
          onError={() => showToast(t('exportFailed'))}
        />
      )}
      <Toast message={toast} />
    </I18nContext.Provider>
  )
}
