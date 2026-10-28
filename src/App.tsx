import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HairSalon } from './components/HairSalon'
import { BackgroundPicker } from './components/BackgroundPicker'
import { AddItemModal } from './components/AddItemModal'
import { SettingsSheet } from './components/SettingsSheet'
import { Closet } from './components/Closet'
import { removeCustomItem, removeCustomRoomItem } from './lib/customItems'
import { hideItem, restoreItems } from './lib/hidden'
import { useItemsVersion } from './lib/useItemsVersion'
import { ExportSheet, type RenderOptions } from './components/ExportSheet'
import { RoomTray } from './components/RoomTray'
import { RoomView } from './components/RoomView'
import { SavedSheet } from './components/SavedSheet'
import { Stage } from './components/Stage'
import { TravelBook } from './components/TravelBook'
import { SendToGameSheet } from './components/SendToGameSheet'
import { PLACE_BY_ID, travelTo } from './lib/game'
import { getParty } from './lib/party'
import { Toast } from './components/Toast'
import { I18nContext, detectLang, makeT, type Lang } from './i18n'
import { BACKGROUNDS, DEFAULT_BG_ID, bgById } from './lib/backgrounds'
import { loadImage, renderOutfitCanvas, renderThumb } from './lib/exportPng'
import type { RoomExportViewport } from './lib/roomExportBounds'
import { CAMP_ASSETS, ROOM_ASSETS, renderRoomCanvas, sceneAssets } from './lib/exportRoom'
import { AVATARS, baseFiles } from './lib/avatars'
import { ITEMS, ITEM_BY_ID, assetUrl, isCustomItem } from './lib/items'
import { CATEGORIES, type Category } from './lib/layers'
import { toggleItem } from './lib/outfit'
import { ROOM_ITEMS, ROOM_ITEM_BY_ID, ROOM_THEME_BY_ID, addItem, isCustomRoomItem, roomFromDecor } from './lib/room'
import { getTravelRoom } from './lib/travelRooms'
import { MAX_PLACED, type RoomGroup, type RoomItemDef, type RoomState, type Selection } from './lib/roomTypes'
import { setSoundEnabled, startBgm, stopBgm } from './lib/sound'
import {
  MAX_SAVED,
  loadCurrent,
  loadCamp,
  loadRoom,
  loadTweaks,
  loadSaved,
  loadSettings,
  persistCurrent,
  persistRoom,
  persistSaved,
  persistSettings,
  persistTweaks,
} from './lib/storage'
import { pruneTweaks, sanitizeTweaks, stripZ } from './lib/tweaks'
import type { Item, Outfit, SavedOutfit, Tweaks } from './lib/types'
// 농장 친구(물 주기)는 농장 탭을 열지 않아도 앱이 켜져 있는 동안 일한다
import './lib/farmFriends'
// 탭 화면은 그 탭을 처음 열 때 받는다(앱 코드를 한 번에 다 받으면 첫 실행이 느렸다). 앱이 설치돼 있으면 미리 저장돼 있어 바로 열린다
const CafeGame = lazy(() => import('./components/CafeGame').then((m) => ({ default: m.CafeGame })))
const KitchenGame = lazy(() => import('./components/KitchenGame').then((m) => ({ default: m.KitchenGame })))
const FarmScene = lazy(() => import('./components/FarmScene').then((m) => ({ default: m.FarmScene })))
const ShopModal = lazy(() => import('./components/ShopModal').then((m) => ({ default: m.ShopModal })))
const TravelGame = lazy(() => import('./components/TravelGame').then((m) => ({ default: m.TravelGame })))

/** 되돌리기: 이 시간(ms) 안에 이어지는 조절은 한 번으로 묶고, 최대 이만큼 기억한다 */
const UNDO_GAP_MS = 500
const UNDO_LIMIT = 50

/** 방 되돌리기: 이 시간(ms) 안에 이어지는 조절(끌기·핀치)은 한 번으로 묶고, 최대 이만큼 기억한다 */
const ROOM_UNDO_GAP_MS = 500
const ROOM_UNDO_LIMIT = 50

type ModalKind = null | 'settings' | 'addItem' | 'addProp' | 'bg' | 'saved' | 'export' | 'roomExport' | 'sendToGame' | 'hair'
type Mode = 'closet' | 'farm' | 'cafe' | 'kitchen' | 'room' | 'travel' | 'shop'

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const newUid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 탭 아이콘(public/assets/tabs2/<icon>.webp). 그림이 아직 없는 탭(주방)은 이모지로 보여 준다 */
const TAB_EMOJI: Record<string, string> = { kitchen: '🍳' }
function TabIcon({ icon }: { icon: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden className="flex h-10 w-10 items-center justify-center leading-none" style={{ fontSize: '1.9rem' }}>{TAB_EMOJI[icon] ?? '⭐'}</span>
  return <img src={assetUrl(`assets/tabs2/${icon}.webp`)} alt="" draggable={false} onError={() => setFailed(true)} className="h-10 w-10 object-contain" />
}

function useWideScreen() {
  const query = '(min-aspect-ratio: 6/5)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export default function App() {
  const initial = useMemo(loadSettings, [])
  const [lang, setLang] = useState<Lang>(initial.lang ?? detectLang())
  const [sound, setSound] = useState(initial.sound ?? true)
  setSoundEnabled(sound) // 놀이 효과음도 설정의 효과음 켜기/끄기를 따른다
  const [bgId, setBgId] = useState(
    initial.bgId && BACKGROUNDS.some((b) => b.id === initial.bgId) ? initial.bgId : DEFAULT_BG_ID,
  )
  const [travelPreview, setTravelPreview] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('closet')
  /** 여행 장소에서 "방 꾸미기"로 들어오면 그 테마 소품 묶음부터 보여 준다 (방 탭을 떠나면 비움) */
  const [trayTheme, setTrayTheme] = useState<string | undefined>()
  useEffect(() => { if (mode !== 'room') setTrayTheme(undefined) }, [mode])
  // 방 탭에 있는 동안 배경 음악(탭을 직접 눌러도, 장소 안 "방" 버튼으로 들어와도 같다)
  // 방 탭은 방 노래, 코디 탭은 상점과 같은 노래(코디 ↔ 상점을 오가도 끊기지 않고 이어진다)
  useEffect(() => { const song = mode === 'room' ? 'room' : mode === 'closet' ? 'shop' : null; if (!song) return; startBgm(song); return stopBgm }, [mode])
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
  /** 내 방과 캠핑 탭은 같은 꾸미기 화면을 쓰고, 지금 보는 쪽이 scene */
  const scene = 'room' as const
  const sceneState = room
  const setScene = setRoom
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

  // 탭을 옮기면 그 탭의 되돌리기 가능 여부로 바꾼다
  useEffect(() => setCanUndoRoom(sceneHistory.current[scene].length > 0), [scene])

  // 착용 순간 깜빡임이 없도록 모든 레이어를 한가할 때 미리 받아 둔다
  useEffect(() => {
    const urls = [
      ...AVATARS.flatMap((a) => a.hairstyles.flatMap((h) => [baseFiles(a, h).body, baseFiles(a, h).hairFront]).map(assetUrl)),
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
  }, [])

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
  /** 여행 장소 안에서 "방 꾸미기": 그 테마 벽·바닥으로 바꾸고 내 방 탭을 연다 (놓은 소품은 그대로) */
  const decorateWith = (placeId: string) => {
    const sent = getTravelRoom(placeId)
    // 그 장소에 보낸 방이 있으면 그 방 그대로, 없으면 그 장소의 기본 모습(벽·바닥과 미리 놓인 가구)으로 시작한다
    if (!sent && !ROOM_THEME_BY_ID[placeId]) { setSelection(null); setMode('room'); return } // 보낸 방이 없는 내 방은 지금 방을 그대로 연다
    const base = sent ? { ...sent.room, wallId: sent.room.wallId ?? placeId, floorId: sent.room.floorId ?? placeId } : roomFromDecor(placeId, room, newUid)
    editRoom(base)
    setSelection(null)
    setTrayTheme(ROOM_THEME_BY_ID[placeId] ? placeId : undefined)
    setMode('room')
    const place = PLACE_BY_ID[placeId]
    showToast(lang === 'ko' ? `${place?.ko ?? ''} 모습으로 꾸며 보세요! (↶ 로 이전 방으로 돌아가요)` : `Decorate the ${place?.en ?? ''} look! (↶ goes back to your last room)`)
  }
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
  }

  const resetRoom = () => {
    if (!window.confirm(t('roomResetConfirm'))) return
    editRoom({ ...room, items: [] }) // 벽지·바닥(과 낮밤)은 두고 놓은 아이템만 모두 치운다
    setSelection(null)
    showToast(t('roomResetDone'))
  }

  const renderOutfit = useCallback((o: RenderOptions) => renderOutfitCanvas(outfit, o, tweaks), [outfit, tweaks])
  const exportViewport = useRef<RoomExportViewport | undefined>(undefined)
  const renderRoom = useCallback(() => renderRoomCanvas(sceneState, outfit, tweaks, scene, exportViewport.current), [sceneState, outfit, tweaks, scene])

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

  /** 상점 화면 (농장·여행에서 이동하고, 닫으면 왔던 곳으로 돌아간다) */
  const shopFrom = useRef<Mode>('closet')

  /** 찾은 아이템을 입어보러 간다 (여행·농장 공통) */
  const wearFound = (id: string) => {
    const prop = ROOM_ITEM_BY_ID[id]
    if (prop) { setMode('room'); setSelection(null); showToast(lang === 'ko' ? '아이템 탭에서 찾은 소품을 사용할 수 있어요.' : 'Your found item is available in Items.'); return }
    const it = ITEM_BY_ID[id]
    if (!it) return
    setCategory(it.category)
    setMode('closet')
    wearItem(it)
  }

  const wide = useWideScreen()
  const [travelFull, setTravelFull] = useState(false)
  const full = mode === 'travel' && travelFull
  const handleFull = useCallback((v: boolean) => setTravelFull(v), [])
  const split = wide && mode !== 'farm' && mode !== 'cafe' && mode !== 'kitchen' && mode !== 'shop'

  const modeBtn = (m: Mode, icon: string, label: string) => (
    <button
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setTravelPreview(null)
        setMode(m)
        setSelection(null)
        setSelCat(null)
      }}
      className={`flex shrink-0 min-h-11 flex-1 items-center justify-center gap-0 rounded-full px-0.5 font-bold whitespace-nowrap transition ${
        mode === m ? 'bg-blush text-white shadow' : 'text-cocoa-soft'
      }`}
    >
      {/* 탭 이름은 아이콘 그림에 크게 들어 있다(화면 읽기용 이름만 따로) */}
      <TabIcon icon={icon} />
      <span className="sr-only">{label}</span>
    </button>
  )

  return (
    <I18nContext.Provider value={i18n}>
      <div className={`mx-auto flex h-dvh flex-col gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] ${full ? '[@media(max-height:500px)]:p-0' : ''}`}>
        <header className={`flex shrink-0 items-center justify-between gap-2 px-1 ${full ? '[@media(max-height:500px)]:hidden' : ''}`}>
            <h1 className="hidden text-lg font-extrabold tracking-tight whitespace-nowrap text-blush-deep xl:block">{t('title')}</h1>
            <div role="tablist" className="flex min-w-0 flex-1 overflow-x-auto rounded-full bg-white/80 p-0.5 shadow-sm">
              {modeBtn('closet', 'closet', t('modeCloset'))}
              {modeBtn('farm', 'farm', lang === 'ko' ? '농장' : 'Farm')}
              {modeBtn('kitchen', 'kitchen', lang === 'ko' ? '주방' : 'Kitchen')}
              {modeBtn('cafe', 'cafe', lang === 'ko' ? '카페' : 'Cafe')}
              {modeBtn('room', 'room', t('modeRoom'))}
              {modeBtn('travel', 'travel', t('modeTravel'))}
              {modeBtn('shop', 'shop', lang === 'ko' ? '상점' : 'Shop')}
            </div>
            <div className="flex shrink-0 items-center gap-1">
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

        <div className={`flex min-h-0 flex-1 gap-2 ${split ? 'flex-row' : 'flex-col'}`}>
          <div className={split ? `relative h-full flex-none ${full ? 'w-full' : mode === 'room' || mode === 'travel' ? 'w-[65%]' : 'w-[58%]'}` : 'relative min-h-0 flex-1'}>
            {mode === 'closet' && (
              <button
                onClick={() => setModal('hair')}
                aria-label={lang === 'ko' ? '헤어숍' : 'Hair salon'}
                title={lang === 'ko' ? '헤어숍' : 'Hair salon'}
                className="absolute top-1 right-1 z-20 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-transparent active:scale-95"
              ><img src={assetUrl('assets/tabs/hairshop.webp')} alt="" draggable={false} className="h-full w-full object-contain drop-shadow-md" /></button>
            )}
            <Suspense fallback={null}>
            {mode === 'shop' ? (
              <ShopModal onClose={() => setMode(shopFrom.current)} onWear={wearFound} outfit={outfit} tweaks={tweaks} />
            ) : mode === 'cafe' ? (
              <CafeGame outfit={outfit} tweaks={tweaks} onKitchen={() => setMode('kitchen')} />
            ) : mode === 'kitchen' ? (
              <KitchenGame outfit={outfit} tweaks={tweaks} onGo={(to) => { if (to === 'party') { setTravelPreview(getParty().place); setMode('travel') } else setMode(to) }} />
            ) : mode === 'farm' ? (
              <FarmScene outfit={outfit} tweaks={tweaks} onKitchen={() => setMode('kitchen')} />
            ) : mode === 'travel' ? (
              <TravelGame
                initialPlaceId={travelPreview}
                outfit={outfit}
                tweaks={tweaks}
                onWear={wearFound}
                onFull={handleFull}
                onDecorate={decorateWith}
                onKitchen={() => setMode('kitchen')}
              />
            ) : mode === 'closet' ? (
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
                </div>
              </Stage>
            ) : (
              <RoomView onViewportChange={value => { exportViewport.current = value }} key={scene} assets={sceneAssets(scene, sceneState.night, sceneState.wallId, sceneState.floorId)} outfit={outfit} tweaks={tweaks} room={sceneState} selection={selection} onSelect={setSelection} onChange={editRoom} canUndo={canUndoRoom} onUndo={undoRoom}>
                <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
                  {fab(t('goCloset'), '👗', () => setMode('closet'))}
                  {room.wallId === 'camp' && fab(room.night ? t('campDay') : t('campNight'), room.night ? '☀️' : '🌙', () => editRoom({ ...room, night: !room.night }))}
                  {fab(t('roomUndo'), '↶', undoRoom, undefined, !canUndoRoom)}
                  {fab(t('roomReset'), '🧹', resetRoom)}
                </div>
              <button onClick={() => setModal('sendToGame')} className="absolute bottom-3 left-3 z-20 min-h-12 rounded-full bg-blush px-4 font-bold text-white shadow-md">🎮 {lang === 'ko' ? '게임에 보내기' : 'Send to game'}</button>
              </RoomView>
            )}
            </Suspense>
          </div>

        <aside hidden={mode === 'farm' || mode === 'cafe' || mode === 'kitchen' || mode === 'shop' || full} className={`flex ${split ? 'min-w-0 flex-1' : 'h-[40dvh] shrink-0'} flex-col overflow-hidden rounded-3xl bg-white/90 shadow-lg ring-1 ring-black/5`}>
          <div id="adjustment-controls" className="shrink-0" />
          {mode === 'travel' ? (
            <TravelBook outfit={outfit} onToggle={(id) => { const it = ITEM_BY_ID[id]; if (it) onToggle(it) }} />
          ) : mode === 'closet' ? (
            <Closet
              split={split}
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
            <RoomTray key={scene} initialTheme={trayTheme} scene={scene} room={sceneState} onAdd={addToRoom} onLoadCamp={() => { const old = loadCamp(); editRoom({ ...old, wallId: 'camp', floorId: 'camp' }); setSelection(null); showToast(lang === 'ko' ? '이전 캠핑을 내 방으로 불러왔어요.' : 'Your previous campsite is now in My room.') }} onAddCustom={(tab) => { setPropGroup(tab === 'theme' || tab === 'background' ? 'furniture' : tab); setModal('addProp') }} onBackground={(part, id) => { const next = { ...room, items: [] }; setSelection(null); const key = part === 'wall' ? 'wallId' : 'floorId'; if (id) next[key] = id; else delete next[key]; editRoom(next) }} onRemoveCustom={removeMyProp} onRestore={(list) => { restoreItems(list.map((d) => d.id)); showToast(t('restored')) }} />
          )}
        </aside>
        </div>
      </div>

      {modal === 'settings' && (
        <SettingsSheet
          sound={sound}
          onBackground={() => setModal('bg')}
          onCamera={() => mode === 'room' ? setModal('roomExport') : hasClothes ? setModal('export') : showToast(t('nothingToSave'))}
          onSaveOutfit={saveCurrent}
          onOpenOutfits={() => setModal('saved')}
          savedCount={saved.length}
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
      {modal === 'hair' && <HairSalon onClose={() => setModal(null)} />}
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
      {modal === 'sendToGame' && <SendToGameSheet scene={scene} room={sceneState} onClose={() => setModal(null)} onApplied={(id) => {
        travelTo(id)
        setTravelPreview(id)
        setMode('travel')
        setSelection(null)
        setModal(null)
        showToast(lang === 'ko' ? '꾸민 방을 게임에 적용했어요!' : 'Your room is now in the game!')
      }} />}
      {modal === 'roomExport' && (
        <ExportSheet
          title={t('roomExportTitle')}
          render={renderRoom}
          showOptions={false}
          background={bg}
          filePrefix={room.wallId === 'camp' ? 'ryuso-camp' : 'ryuso-room'}
          onClose={() => setModal(null)}
          onError={() => showToast(t('exportFailed'))}
        />
      )}
      <Toast message={toast} />
    </I18nContext.Provider>
  )
}

