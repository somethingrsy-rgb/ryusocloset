import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackgroundPicker } from './components/BackgroundPicker'
import { AddItemModal } from './components/AddItemModal'
import { SettingsSheet } from './components/SettingsSheet'
import { startSync } from './lib/sync/manager'
import { Closet } from './components/Closet'
import { removeCustomItem, removeCustomRoomItem } from './lib/customItems'
import { hideItem, restoreItems, visible } from './lib/hidden'
import { useItemsVersion } from './lib/useItemsVersion'
import { ExportSheet, type RenderOptions } from './components/ExportSheet'
import { RoomTray } from './components/RoomTray'
import { RoomView } from './components/RoomView'
import { SavedSheet } from './components/SavedSheet'
import { Stage } from './components/Stage'
import { Toast } from './components/Toast'
import { I18nContext, detectLang, makeT, type Lang } from './i18n'
import { BACKGROUNDS, DEFAULT_BG_ID, bgById } from './lib/backgrounds'
import { loadImage, renderOutfitCanvas, renderThumb } from './lib/exportPng'
import { CAMP_ASSETS, ROOM_ASSETS, renderRoomCanvas, sceneAssets } from './lib/exportRoom'
import { BASE_LAYERS, ITEMS, ITEMS_BY_CATEGORY, assetUrl, isCustomItem } from './lib/items'
import { CATEGORIES, type Category } from './lib/layers'
import { randomOutfit, toggleItem } from './lib/outfit'
import { ROOM_ITEMS, addItem, defaultCamp, defaultRoom, isCustomRoomItem } from './lib/room'
import { MAX_PLACED, type RoomGroup, type RoomItemDef, type RoomState, type Selection } from './lib/roomTypes'
import { playSnap } from './lib/sound'
import {
  MAX_SAVED,
  loadCurrent,
  loadCamp,
  loadRoom,
  loadTweaks,
  loadSaved,
  loadSettings,
  persistCurrent,
  persistCamp,
  persistRoom,
  persistSaved,
  persistSettings,
  persistTweaks,
} from './lib/storage'
import { pruneTweaks, sanitizeTweaks, stripZ } from './lib/tweaks'
import type { Item, Outfit, SavedOutfit, Tweaks } from './lib/types'

/** 되돌리기: 이 시간(ms) 안에 이어지는 조절은 한 번으로 묶고, 최대 이만큼 기억한다 */
const UNDO_GAP_MS = 500
const UNDO_LIMIT = 50

/** 방 되돌리기: 이 시간(ms) 안에 이어지는 조절(끌기·핀치)은 한 번으로 묶고, 최대 이만큼 기억한다 */
const ROOM_UNDO_GAP_MS = 500
const ROOM_UNDO_LIMIT = 50

type ModalKind = null | 'settings' | 'addItem' | 'addProp' | 'bg' | 'saved' | 'export' | 'roomExport'
type Mode = 'closet' | 'room' | 'camp'

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const newUid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export default function App() {
  const initial = useMemo(loadSettings, [])
  const [lang, setLang] = useState<Lang>(initial.lang ?? detectLang())
  const [sound, setSound] = useState(initial.sound ?? true)
  const [bgId, setBgId] = useState(
    initial.bgId && BACKGROUNDS.some((b) => b.id === initial.bgId) ? initial.bgId : DEFAULT_BG_ID,
  )
  useEffect(() => void startSync(), [])
  const [mode, setMode] = useState<Mode>('closet')
  const [outfit, setOutfit] = useState<Outfit>(loadCurrent)
  const [tweaks, setTweaks] = useState<Tweaks>(() => loadTweaks(loadCurrent()))
  /** 위치·크기 조절의 실행 취소 기록 (옷을 바꾸면 비운다) */
  const tweakHistory = useRef<Tweaks[]>([])
  const lastTweakEdit = useRef(0)
  const [canUndo, setCanUndo] = useState(false)
  const [selCat, setSelCat] = useState<Category | null>(null)
  const [dragOver, setDragOver] = useState(false)
  useItemsVersion()
  const [category, setCategory] = useState<Category>('top')
  const [propGroup, setPropGroup] = useState<RoomGroup>('furniture')
  const [saved, setSaved] = useState<SavedOutfit[]>(loadSaved)
  const [room, setRoom] = useState<RoomState>(loadRoom)
  const [camp, setCamp] = useState<RoomState>(loadCamp)
  /** 내 방과 캠핑 탭은 같은 꾸미기 화면을 쓰고, 지금 보는 쪽이 scene */
  const scene: 'room' | 'camp' = mode === 'camp' ? 'camp' : 'room'
  const sceneState = scene === 'camp' ? camp : room
  const setScene = scene === 'camp' ? setCamp : setRoom
  /** 방 되돌리기 기록 (놓기·옮기기·크기·뒤집기·삭제·초기화 모두) */
  const sceneHistory = useRef<Record<'room' | 'camp', RoomState[]>>({ room: [], camp: [] })
  const lastRoomEdit = useRef(0)
  const [canUndoRoom, setCanUndoRoom] = useState(false)
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
  useEffect(() => {
    tweakHistory.current = []
    setCanUndo(false)
  }, [outfit])

  /** 조절값을 바꾼다. 끌기·핀치처럼 0.5초 안에 이어지는 변경은 하나로 묶어 한 번에 되돌린다 */
  const editTweaks = (next: Tweaks) => {
    const now = Date.now()
    if (now - lastTweakEdit.current > UNDO_GAP_MS) {
      tweakHistory.current = [...tweakHistory.current, tweaks].slice(-UNDO_LIMIT)
      setCanUndo(true)
    }
    lastTweakEdit.current = now
    setTweaks(next)
  }
  const undoTweaks = () => {
    const prev = tweakHistory.current.pop()
    if (!prev) return
    lastTweakEdit.current = 0
    setTweaks(prev)
    setCanUndo(tweakHistory.current.length > 0)
  }
  // 드래그 중에는 상태가 자주 바뀌므로 잠깐 모았다가 저장
  useEffect(() => {
    const id = window.setTimeout(() => persistRoom(room), 300)
    return () => window.clearTimeout(id)
  }, [room])
  useEffect(() => {
    const id = window.setTimeout(() => persistCamp(camp), 300)
    return () => window.clearTimeout(id)
  }, [camp])
  // 탭을 옮기면 그 탭의 되돌리기 가능 여부로 바꾼다
  useEffect(() => setCanUndoRoom(sceneHistory.current[scene].length > 0), [scene])

  // 착용 순간 깜빡임이 없도록 모든 레이어를 한가할 때 미리 받아 둔다
  useEffect(() => {
    const urls = [
      ...Object.values(BASE_LAYERS),
      ...ITEMS.map((i) => assetUrl(i.image)),
      ...Object.values(ROOM_ASSETS),
      ...Object.values(CAMP_ASSETS),
      ...ROOM_ITEMS.map((d) => assetUrl(d.image)),
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
    // 옷을 바꾸면 겹치는 순서는 처음 순서로 돌아간다 (위치·크기 조절은 같은 옷이면 그대로)
    setTweaks(stripZ(pruneTweaks(CATEGORIES, outfit, next, tweaks)))
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

  /** 내가 추가한 옷 지우기 (입고 있으면 벗긴다) */
  const removeMine = (item: Item) => {
    if (outfit[item.category] === item.id) {
      const next = { ...outfit }
      delete next[item.category]
      applyOutfit(next)
    }
    if (isCustomItem(item)) void removeCustomItem(item.id)
    else hideItem(item.id)
    showToast(t('removed'))
  }

  /** 방을 바꾼다 (되돌릴 수 있게 이전 상태를 기록) */
  const editRoom = (next: RoomState) => {
    const now = Date.now()
    if (now - lastRoomEdit.current > ROOM_UNDO_GAP_MS) {
      sceneHistory.current[scene] = [...sceneHistory.current[scene], sceneState].slice(-ROOM_UNDO_LIMIT)
      setCanUndoRoom(true)
    }
    lastRoomEdit.current = now
    setScene(next)
  }
  const undoRoom = () => {
    const prev = sceneHistory.current[scene].pop()
    if (!prev) return
    lastRoomEdit.current = 0
    setScene(prev)
    setSelection(null)
    setCanUndoRoom(sceneHistory.current[scene].length > 0)
  }

  /** 내가 추가한 방 소품 지우기 (방에 놓인 것도 함께 치운다) */
  const removeMyProp = (def: RoomItemDef) => {
    editRoom({ ...sceneState, items: sceneState.items.filter((p) => p.itemId !== def.id) })
    setSelection(null)
    if (isCustomRoomItem(def)) void removeCustomRoomItem(def.id)
    else hideItem(def.id)
    showToast(t('removed'))
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
    setOutfit(randomOutfit(Object.fromEntries(CATEGORIES.map((c) => [c, visible(ITEMS_BY_CATEGORY[c])])) as typeof ITEMS_BY_CATEGORY))
    setTweaks({})
    setSelCat(null)
    snap()
  }

  const hasClothes = Object.keys(outfit).length > 0

  const saveCurrent = async () => {
    if (!hasClothes) return showToast(t('nothingToSave'))
    if (saved.length >= MAX_SAVED) return showToast(t('savedFull', { n: MAX_SAVED }))
    try {
      const thumb = await renderThumb(outfit, bg, tweaks)
      const entry: SavedOutfit = { id: newUid(), createdAt: Date.now(), outfit, tweaks, bgId, thumb }
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
    setTweaks(sanitizeTweaks(s.tweaks, CATEGORIES, s.outfit))
    setSelCat(null)
    if (BACKGROUNDS.some((b) => b.id === s.bgId)) setBgId(s.bgId)
    snap()
    showToast(t('loaded'))
  }

  /* ── 방 ── */
  const addToRoom = (def: RoomItemDef) => {
    const uid = newUid()
    const next = addItem(sceneState, def, uid)
    if (!next) return showToast(t('roomFull', { n: MAX_PLACED }))
    editRoom(next)
    setSelection({ kind: 'item', uid })
    if (sound) playSnap()
  }

  const resetRoom = () => {
    if (!window.confirm(t(scene === 'camp' ? 'campResetConfirm' : 'roomResetConfirm'))) return
    editRoom(scene === 'camp' ? { ...defaultCamp(), night: camp.night } : defaultRoom())
    setSelection(null)
    showToast(t('roomResetDone'))
  }

  const renderOutfit = useCallback((o: RenderOptions) => renderOutfitCanvas(outfit, o, tweaks), [outfit, tweaks])
  const renderRoom = useCallback(() => renderRoomCanvas(sceneState, outfit, tweaks, scene), [sceneState, outfit, tweaks, scene])

  const fab = (label: string, icon: string, onClick: () => void, badge?: number, disabled?: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-xl shadow-md ring-1 ring-black/5 backdrop-blur transition active:scale-90 disabled:opacity-40"
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
        setSelection(null)
        setSelCat(null)
      }}
      className={`flex min-h-11 items-center gap-0.5 rounded-full px-2 text-[12.5px] font-bold whitespace-nowrap transition ${
        mode === m ? 'bg-blush text-white shadow' : 'text-cocoa-soft'
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  )

  return (
    <I18nContext.Provider value={i18n}>
      <div className="mx-auto flex h-dvh max-w-[1100px] flex-col gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:flex-row md:gap-4 md:p-4">
        <section className="flex min-h-0 flex-1 flex-col gap-2">
          <header className="flex shrink-0 items-center justify-between gap-2 px-1">
            <h1 className="hidden text-lg font-extrabold tracking-tight whitespace-nowrap text-blush-deep min-[430px]:block">{t('title')}</h1>
            <div role="tablist" className="flex shrink-0 rounded-full bg-white/80 p-0.5 shadow-sm">
              {modeBtn('closet', '👗', t('modeCloset'))}
              {modeBtn('room', '🏠', t('modeRoom'))}
              {modeBtn('camp', '⛺', t('modeCamp'))}
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
                onClick={() => setModal('settings')}
                aria-label={t('settings')}
                title={t('settings')}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-lg shadow-sm"
              >
                <span aria-hidden>⚙️</span>
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            {mode === 'closet' ? (
              <Stage
                outfit={outfit}
                tweaks={tweaks}
                bg={bg}
                selected={selCat}
                onSelect={setSelCat}
                onTweaks={editTweaks}
                canUndo={canUndo}
                onUndo={undoTweaks}
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
              <RoomView key={scene} assets={sceneAssets(scene, sceneState.night, sceneState.wallId, sceneState.floorId)} outfit={outfit} tweaks={tweaks} room={sceneState} selection={selection} onSelect={setSelection} onChange={editRoom} canUndo={canUndoRoom} onUndo={undoRoom}>
                <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
                  {fab(t('goCloset'), '👗', () => setMode('closet'))}
                  {scene === 'camp' && fab(camp.night ? t('campDay') : t('campNight'), camp.night ? '☀️' : '🌙', () => editRoom({ ...camp, night: !camp.night }))}
                  {fab(t('roomUndo'), '↶', undoRoom, undefined, !canUndoRoom)}
                  {fab(t('roomReset'), '🧹', resetRoom)}
                  {fab(t('roomExport'), '📷', () => setModal('roomExport'))}
                </div>
              </RoomView>
            )}
          </div>
        </section>

        <aside className="flex h-[40dvh] shrink-0 flex-col overflow-hidden rounded-3xl bg-white/90 shadow-lg ring-1 ring-black/5 md:h-auto md:w-[400px]">
          {mode === 'closet' ? (
            <Closet
              category={category}
              onCategory={setCategory}
              outfit={outfit}
              onToggle={onToggle}
              onDragWear={wearItem}
              dropRef={dropRef}
              onDragOver={setDragOver}
              onAdd={() => setModal('addItem')}
              onRemove={removeMine}
              onRestore={(list) => { restoreItems(list.map((i) => i.id)); showToast(t('restored')) }}
            />
          ) : (
            <RoomTray key={scene} scene={scene} room={sceneState} onAdd={addToRoom} onAddCustom={(tab) => { setPropGroup(tab === 'theme' || tab === 'background' ? 'furniture' : tab); setModal('addProp') }} onBackground={(part, id) => { const next = { ...room }; const key = part === 'wall' ? 'wallId' : 'floorId'; if (id) next[key] = id; else delete next[key]; editRoom(next) }} onRemoveCustom={removeMyProp} onRestore={(list) => { restoreItems(list.map((d) => d.id)); showToast(t('restored')) }} />
          )}
        </aside>
      </div>

      {modal === 'settings' && (
        <SettingsSheet
          sound={sound}
          onSound={() => setSound((v) => !v)}
          onLang={() => setLang((l) => (l === 'ko' ? 'en' : 'ko'))}
          onClose={() => setModal(null)}
          onToast={showToast}
        />
      )}
      {modal === 'addItem' && (
        <AddItemModal
          kind="closet"
          initial={category}
          onClose={() => setModal(null)}
          onError={showToast}
          onAdded={(item, persisted) => {
            setModal(null)
            setMode('closet')
            setCategory(item.category)
            applyOutfit(toggleItem(outfit, item), item)
            showToast(t(persisted ? 'addDone' : 'addDoneNoSave'))
          }}
        />
      )}
      {modal === 'addProp' && (
        <AddItemModal
          kind="room"
          initial={propGroup}
          onClose={() => setModal(null)}
          onError={showToast}
          onAdded={(def, persisted) => {
            setModal(null)
            addToRoom(def)
            showToast(t(persisted ? 'addDone' : 'addDoneNoSave'))
          }}
        />
      )}
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
          showOptions
          background={bg}
          filePrefix="ryuso-closet"
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
          filePrefix={scene === 'camp' ? 'ryuso-camp' : 'ryuso-room'}
          onClose={() => setModal(null)}
          onError={() => showToast(t('exportFailed'))}
        />
      )}
      <Toast message={toast} />
    </I18nContext.Provider>
  )
}
