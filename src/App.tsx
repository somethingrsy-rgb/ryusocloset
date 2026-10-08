import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AssembleStage, assemblyLayers } from './components/AssembleStage'
import { AssembleTray } from './components/AssembleTray'
import { BackgroundPicker } from './components/BackgroundPicker'
import { Closet } from './components/Closet'
import { ExportSheet, type RenderOptions } from './components/ExportSheet'
import { RoomEconomyPanel } from './components/RoomEconomyPanel'
import { useEconomy } from './state/useEconomy'
import { toCanvas } from 'html-to-image'
import { RoomView } from './components/RoomView'
import { SavedSheet } from './components/SavedSheet'
import { Stage } from './components/Stage'
import { Toast } from './components/Toast'
import { I18nContext, detectLang, makeT, type Lang } from './i18n'
import { ASSEMBLE_PARTS, randomAssembly, takeOffPart, togglePart, type Assembly, type AssembleTweaks, type Slot } from './lib/assemble'
import { BACKGROUNDS, DEFAULT_BG_ID, bgById } from './lib/backgrounds'
import { finishFigure, loadImage, renderAssembly, renderOutfitCanvas, renderThumb } from './lib/exportPng'
import { ROOM_ASSETS, renderRoomCanvas } from './lib/exportRoom'
import { BASE_LAYERS, ITEMS, ITEMS_BY_CATEGORY, assetUrl } from './lib/items'
import { CATEGORIES, type Category } from './lib/layers'
import { randomOutfit, toggleItem } from './lib/outfit'
import { ROOM_ITEMS, defaultRoom, placeInSlot } from './lib/room'
import { type RoomItemDef, type RoomState, type Selection } from './lib/roomTypes'
import { playSnap } from './lib/sound'
import {
  MAX_SAVED,
  loadAssembly,
  loadCurrent,
  loadRoom,
  loadTweaks,
  loadSaved,
  loadSettings,
  persistAssembly,
  persistCurrent,
  persistRoom,
  persistSaved,
  persistSettings,
  persistTweaks,
} from './lib/storage'
import { getTweak, pruneTweaks, sanitizeTweaks } from './lib/tweaks'
import type { Item, Outfit, SavedOutfit, Tweaks } from './lib/types'

type ModalKind = null | 'bg' | 'saved' | 'export' | 'roomExport' | 'assembleExport'
type Mode = 'closet' | 'room' | 'assemble' | 'shop' | 'collection'

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const newUid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export default function App() {
  const initial = useMemo(loadSettings, [])
  const [lang, setLang] = useState<Lang>(initial.lang ?? detectLang())
  const [sound, setSound] = useState(initial.sound ?? true)
  const [bgId, setBgId] = useState(
    initial.bgId && BACKGROUNDS.some((b) => b.id === initial.bgId) ? initial.bgId : DEFAULT_BG_ID,
  )
  const [mode, setMode] = useState<Mode>('closet')
  const [outfit, setOutfit] = useState<Outfit>(loadCurrent)
  const [tweaks, setTweaks] = useState<Tweaks>(() => loadTweaks(loadCurrent()))
  const [selCat, setSelCat] = useState<Category | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [category, setCategory] = useState<Category>('top')
  const [saved, setSaved] = useState<SavedOutfit[]>(loadSaved)
  const [room, setRoom] = useState<RoomState>(loadRoom)
  const [preview, setPreview] = useState<RoomState | null>(null)
  const [roomAsBackground, setRoomAsBackground] = useState(false)
  const economy = useEconomy()
  const roomCaptureRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
  const [assembly, setAssembly] = useState<Assembly>(loadAssembly)
  const [selSlot, setSelSlot] = useState<Slot | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [toast, setToast] = useState<string | null>(null)
  const figureRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
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
  useEffect(() => void persistTweaks(tweaks), [tweaks])
  useEffect(() => void persistAssembly(assembly), [assembly])
  // 드래그 중에는 상태가 자주 바뀌므로 잠깐 모았다가 저장
  useEffect(() => {
    const id = window.setTimeout(() => persistRoom(room), 300)
    return () => window.clearTimeout(id)
  }, [room])

  // 착용 순간 깜빡임이 없도록 모든 레이어를 한가할 때 미리 받아 둔다
  useEffect(() => {
    const urls = [
      ...Object.values(BASE_LAYERS),
      ...ITEMS.map((i) => assetUrl(i.image)),
      ...Object.values(ROOM_ASSETS),
      ...ROOM_ITEMS.map((d) => assetUrl(d.image)),
      ...ASSEMBLE_PARTS.map((p) => assetUrl(p.image)),
    ]
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

  /* ── 코디 ── */
  /** 입은 옷을 바꾼다: 바뀐 카테고리의 위치·크기 조절은 버리고, 새로 입은 옷을 선택한다 */
  const applyOutfit = (next: Outfit, picked?: Item) => {
    setTweaks(pruneTweaks(CATEGORIES, outfit, next, tweaks))
    setOutfit(next)
    setSelCat((sel) => {
      if (picked && next[picked.category] === picked.id) return picked.category
      return sel && next[sel] ? sel : null
    })
  }

  const onToggle = (item: Item) => {
    const next = toggleItem(outfit, item)
    applyOutfit(next, item)
    if (next[item.category] === item.id) snap()
  }

  /** 옷을 끌어다 아바타에 놓았을 때: 이미 입고 있으면 선택만 하고, 아니면 입힌다 */
  const wearItem = (item: Item) => {
    if (outfit[item.category] === item.id) return setSelCat(item.category)
    onToggle(item)
  }

  const takeOff = (c: Category) => {
    const next = { ...outfit }
    delete next[c]
    applyOutfit(next)
  }

  const clearAll = () => {
    setOutfit({})
    setTweaks({})
    setSelCat(null)
  }

  const onRandom = () => {
    setOutfit(randomOutfit(ITEMS_BY_CATEGORY))
    setTweaks({})
    setSelCat(null)
    snap()
  }

  const hasClothes = Object.keys(outfit).length > 0

  const saveCurrent = async () => {
    if (!hasClothes) return showToast(t('nothingToSave'))
    if (saved.length >= MAX_SAVED) return showToast(t('savedFull', { n: MAX_SAVED }))
    if (savingRef.current) return
    savingRef.current = true
    try {
      const thumb = await renderThumb(outfit, bg, tweaks)
      const entry: SavedOutfit = { id: newUid(), createdAt: Date.now(), outfit, tweaks, bgId, thumb }
      const next = [entry, ...saved]
      if (!persistSaved(next)) return showToast(t('saveFailed'))
      setSaved(next)
      const before = useEconomy.getState().data.points
      const rewarded = economy.saveReward(JSON.stringify(Object.entries(outfit).sort(([a],[b]) => a.localeCompare(b))))
      showToast(rewarded && useEconomy.getState().data.points > before ? `${t('saved')} · ★ +${useEconomy.getState().data.points-before}` : t('saved'))
    } catch {
      showToast(t('exportFailed'))
    } finally { savingRef.current = false }
  }

  const deleteSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id)
    setSaved(next)
    persistSaved(next)
  }

  const loadOutfit = (s: SavedOutfit) => {
    setOutfit(s.outfit)
    setTweaks(sanitizeTweaks(s.tweaks, CATEGORIES, s.outfit))
    setSelCat(null)
    if (BACKGROUNDS.some((b) => b.id === s.bgId)) setBgId(s.bgId)
    snap()
    showToast(t('loaded'))
  }

  /* ── 방 ── */
  const addToRoom = (def: RoomItemDef) => {
    try { setRoom(placeInSlot(room, def, economy.data.owned)); setPreview(null); setSelection(null); if (sound) playSnap() }
    catch { showToast(lang === 'ko' ? '먼저 상점에서 구매해 주세요.' : 'Purchase this item first.') }
  }

  const resetRoom = () => {
    if (!window.confirm(t('roomResetConfirm'))) return
    setRoom(defaultRoom())
    setPreview(null)
    setSelection(null)
    showToast(t('roomResetDone'))
  }

  const renderAssembleExport = useCallback(
    async (o: RenderOptions) =>
      finishFigure(
        await renderAssembly(
          assemblyLayers(assembly).map((l) => ({ src: l.src, box: l.box, tweak: getTweak(assembly.tweaks ?? {}, l.key) })),
        ),
        o,
      ),
    [assembly],
  )
  /** 탭: 입고/벗기. 새로 입으면 그 부품을 선택해서 바로 옮기거나 키울 수 있게 한다 */
  const pickPart = (slot: Slot, id: string) => {
    const next = togglePart(assembly, slot, id)
    setAssembly(next)
    setSelSlot(next[slot] === id ? slot : selSlot === slot ? null : selSlot)
    if (sound && next[slot] === id) playSnap()
  }
  /** 끌어다 놓기: 이미 입고 있으면 선택만 한다 */
  const wearPart = (slot: Slot, id: string) => {
    if (assembly[slot] === id) return setSelSlot(slot)
    pickPart(slot, id)
  }
  const setAssembleTweaks = (tweaks: AssembleTweaks) =>
    setAssembly((a) => {
      const next = { ...a }
      if (Object.keys(tweaks).length) next.tweaks = tweaks
      else delete next.tweaks
      return next
    })
  const takeOffSlot = (slot: Slot) => {
    setAssembly((a) => takeOffPart(a, slot))
    setSelSlot(null)
  }

  const renderOutfit = useCallback((o: RenderOptions) => roomAsBackground ? renderRoomCanvas(room, outfit, tweaks) : renderOutfitCanvas(outfit, o, tweaks), [outfit, tweaks, room, roomAsBackground])
  const renderRoom = useCallback(async () => {
    if (roomCaptureRef.current) { try { return await toCanvas(roomCaptureRef.current, { canvasWidth: 1086, canvasHeight: 1448, pixelRatio: 1, filter: node => !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true') }) } catch { /* Canvas fallback also supports offline export. */ } }
    return renderRoomCanvas(room, outfit, tweaks)
  }, [room, outfit, tweaks])

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

  const modeBtn = (m: Mode, icon: string, label: string) => (
    <button
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m)
        setPreview(null)
        setSelection(null)
        setSelCat(null)
        setSelSlot(null)
      }}
      className={`flex min-h-11 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold whitespace-nowrap transition ${
        mode === m ? 'bg-blush text-white shadow' : 'text-cocoa-soft'
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  )

  return (
    <I18nContext.Provider value={i18n}>
      <div className="mx-auto flex h-dvh max-w-[1100px] flex-col gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-20 md:flex-row md:gap-4 md:p-4 md:pb-20">
        <section className="flex min-h-0 flex-1 flex-col gap-2">
          <header className="flex shrink-0 items-center justify-between gap-2 px-1">
            <h1 className="hidden text-lg font-extrabold tracking-tight whitespace-nowrap text-blush-deep min-[430px]:block">{t('title')}</h1>
            <div role="tablist" className="flex shrink-0 rounded-full bg-white/80 p-0.5 shadow-sm">
              {modeBtn('assemble', '🧩', t('modeAssemble'))}
              <button className="flex min-h-11 items-center rounded-full px-3 font-bold text-blush-deep" onClick={() => {setMode('shop');setPreview(null)}} aria-label={lang === 'ko' ? '별과 상점' : 'Stars and shop'}>★ {economy.data.points}</button>
            </div>
            <div className="flex items-center gap-1.5">
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
                aria-label={lang === 'ko' ? 'English' : '한국어'}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-sm font-bold shadow-sm"
              >
                {t('language')}
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            {mode === 'assemble' ? (
              <AssembleStage
                assembly={assembly}
                bg={bg}
                selected={selSlot}
                onSelect={setSelSlot}
                onTweaks={setAssembleTweaks}
                onTakeOff={takeOffSlot}
                dropRef={dropRef}
                dropActive={dragOver}
                figureRef={figureRef}
              >
                <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
                  {fab(t('random'), '🎲', () => {
                    setAssembly(randomAssembly())
                    setSelSlot(null)
                    if (sound) playSnap()
                  })}
                  {fab(t('reset'), '🧺', () => {
                    setAssembly((a) => ({ head: a.head }))
                    setSelSlot(null)
                  })}
                  {fab(t('background'), '🖼️', () => setModal('bg'))}
                  {fab(t('exportImage'), '📷', () => setModal('assembleExport'))}
                </div>
              </AssembleStage>
            ) : mode === 'closet' ? (
              <Stage
                outfit={outfit}
                tweaks={tweaks}
                bg={bg}
                selected={selCat}
                onSelect={setSelCat}
                onTweaks={setTweaks}
                onTakeOff={takeOff}
                dropRef={dropRef}
                dropActive={dragOver}
                figureRef={figureRef}
              >
                <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
                  {fab(t('random'), '🎲', onRandom)}
                  {fab(t('reset'), '🧺', clearAll)}
                  {fab(t('background'), '🖼️', () => setModal('bg'))}
                  {fab(t('saveOutfit'), '💾', saveCurrent)}
                  {fab(t('myOutfits'), '📒', () => setModal('saved'), saved.length)}
                  {fab(t('exportImage'), '📷', () => (hasClothes ? setModal('export') : showToast(t('nothingToSave'))))}
                </div>
              </Stage>
            ) : (
              <RoomView outfit={outfit} tweaks={tweaks} room={preview ?? room} selection={selection} onSelect={setSelection} onChange={mode === 'room' ? setRoom : () => undefined} onCloset={() => {setMode('closet');setPreview(null)}} captureRef={roomCaptureRef}>
                <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
                  {fab(t('goCloset'), '👗', () => setMode('closet'))}
                  {fab(t('roomReset'), '🧹', resetRoom)}
                  {fab(t('roomExport'), '📷', () => {setPreview(null);setSelection(null);setModal('roomExport')})}
                </div>
              </RoomView>
            )}
          </div>
        </section>

        <aside className="flex h-[40dvh] shrink-0 flex-col overflow-hidden rounded-3xl bg-white/90 shadow-lg ring-1 ring-black/5 md:h-auto md:w-[400px]">
          {mode === 'assemble' ? (
            <AssembleTray assembly={assembly} onPick={pickPart} onDragWear={wearPart} dropRef={dropRef} onDragOver={setDragOver} />
          ) : mode === 'closet' ? (
            <Closet
              category={category}
              onCategory={setCategory}
              outfit={outfit}
              onToggle={onToggle}
              onDragWear={wearItem}
              dropRef={dropRef}
              onDragOver={setDragOver}
            />
          ) : (
            <RoomEconomyPanel view={mode === 'shop' ? 'shop' : mode === 'collection' ? 'collection' : 'room'} room={room} outfit={outfit} tweaks={tweaks} onPlace={addToRoom} onRoom={setRoom} onPreview={d => setPreview(d ? placeInSlot(room, d, [...economy.data.owned, d.id]) : null)} onRestore={(r,o,tw) => {setRoom(r);setOutfit(o);setTweaks(tw);setSelection(null)}} onToast={showToast} />
          )}
        </aside>
      </div>

      <nav className="bottom-nav" aria-label={lang === 'ko' ? '메인 메뉴' : 'Main navigation'}>{modeBtn('closet','👗',t('modeCloset'))}{modeBtn('room','🏠',t('modeRoom'))}{modeBtn('shop','🛍️',lang === 'ko' ? '상점' : 'Shop')}{modeBtn('collection','📖',lang === 'ko' ? '도감' : 'Collection')}</nav>
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
          title={t('exportTitle')}
          render={renderOutfit}
          extra={<button className="primary-action" aria-pressed={roomAsBackground} onClick={() => setRoomAsBackground(v => !v)}>{lang === 'ko' ? (roomAsBackground ? '배경: 내 방 ✓' : '내 방을 완성샷 배경으로 사용') : (roomAsBackground ? 'Background: My room ✓' : 'Use my room as photo background')}</button>}
          showOptions={!roomAsBackground}
          background={bg}
          filePrefix="ryuso-closet"
          onClose={() => setModal(null)}
          onError={() => showToast(t('exportFailed'))}
        />
      )}
      {modal === 'assembleExport' && (
        <ExportSheet
          title={t('exportTitle')}
          render={renderAssembleExport}
          showOptions
          background={bg}
          filePrefix="ryuso-mix"
          onClose={() => setModal(null)}
          onError={() => showToast(t('exportFailed'))}
        />
      )}
      {modal === 'roomExport' && (
        <ExportSheet
          title={t('roomExportTitle')}
          render={renderRoom}
          showOptions={false}
          background={bg}
          filePrefix="ryuso-room"
          onClose={() => setModal(null)}
          onError={() => showToast(t('exportFailed'))}
        />
      )}
      <Toast message={toast} />
    </I18nContext.Provider>
  )
}
