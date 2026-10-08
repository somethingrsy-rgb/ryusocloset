import { createContext, useContext } from 'react'
import type { Category } from '../lib/layers'

export type Lang = 'ko' | 'en'

const ko = {
  title: '류소 옷장',
  random: '랜덤 코디',
  reset: '전체 벗기기',
  background: '배경',
  saveOutfit: '코디 저장',
  myOutfits: '내 코디',
  exportImage: '이미지 저장',
  soundOn: '효과음 켜기',
  soundOff: '효과음 끄기',
  language: 'EN',
  close: '닫기',
  saved: '저장했어요!',
  savedFull: '더 저장할 수 없어요 (최대 {n}개)',
  saveFailed: '저장 공간이 부족해요',
  savedEmpty: '아직 저장한 코디가 없어요',
  savedEmptyHint: '마음에 드는 코디를 만들고 저장 버튼을 눌러보세요',
  saveCurrent: '지금 코디 저장하기',
  delete: '삭제',
  deleteConfirm: '이 코디를 삭제할까요?',
  loaded: '코디를 불러왔어요',
  nothingToSave: '먼저 옷을 입혀 주세요',
  exportTitle: '이미지로 저장',
  withBackground: '배경 포함',
  transparent: '투명 배경',
  sticker: '스티커 테두리',
  download: '다운로드',
  share: '공유',
  rendering: '만드는 중…',
  exportFailed: '이미지를 만들지 못했어요',
  worn: '착용 중',
  bgTitle: '배경 고르기',
  count: '{n}개',
  modeCloset: '코디',
  modeRoom: '내 방',
  roomAvatar: '나',
  roomAria: '방 꾸미기 화면. 방향키로 이동, +/-로 크기, F로 좌우 반전, Delete로 치우기',
  roomHint: '가구를 눌러 방에 놓고, 끌어서 옮겨요',
  smaller: '작게',
  bigger: '크게',
  flip: '좌우 반전',
  remove: '치우기',
  roomReset: '방 초기화',
  roomResetConfirm: '방을 처음 모습으로 되돌릴까요?',
  roomExport: '방 사진 저장',
  roomExportTitle: '방 사진 저장',
  goCloset: '코디 바꾸기',
  roomFull: '물건이 너무 많아요 (최대 {n}개)',
  roomResetDone: '방을 처음 모습으로 되돌렸어요',
  dragHint: '옷을 길게 눌러 아바타에 끌어다 놓아요',
  tweakHint: '옷을 눌러 끌어 옮기고, 핀치로 크기 조절',
  tweakAria: '입은 옷 조절 화면. 방향키로 이동, +/-로 크기, 0으로 원래대로, Delete로 벗기',
  tweakReset: '원래대로',
  takeOff: '벗기',
  dropHere: '여기에 놓아요',
  modeAssemble: '조립',
  partHead: '머리',
  partTop: '상의',
  partBottom: '하의',
  assembleHint: '머리·상의·하의를 따로 골라 조립해요',
  assembleTopHint: '상의는 팔과 손까지 한 벌이에요',
  noBottoms: '하의가 아직 없어요',
} as const

type Dict = Record<keyof typeof ko, string>

const en: Dict = {
  title: "Ryuso's Closet",
  random: 'Random outfit',
  reset: 'Undress all',
  background: 'Background',
  saveOutfit: 'Save outfit',
  myOutfits: 'My outfits',
  exportImage: 'Save image',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  language: '한',
  close: 'Close',
  saved: 'Saved!',
  savedFull: 'Storage is full (max {n})',
  saveFailed: 'Not enough storage space',
  savedEmpty: 'No saved outfits yet',
  savedEmptyHint: 'Style an outfit you like and tap Save',
  saveCurrent: 'Save current outfit',
  delete: 'Delete',
  deleteConfirm: 'Delete this outfit?',
  loaded: 'Outfit loaded',
  nothingToSave: 'Put on some clothes first',
  exportTitle: 'Save as image',
  withBackground: 'With background',
  transparent: 'Transparent',
  sticker: 'Sticker outline',
  download: 'Download',
  share: 'Share',
  rendering: 'Rendering…',
  exportFailed: 'Could not create the image',
  worn: 'Wearing',
  bgTitle: 'Pick a background',
  count: '{n}',
  modeCloset: 'Outfit',
  modeRoom: 'My room',
  roomAvatar: 'Me',
  roomAria: 'Room decorating. Arrow keys move, +/- resize, F flips, Delete removes',
  roomHint: 'Tap an item to place it, drag to move',
  smaller: 'Smaller',
  bigger: 'Bigger',
  flip: 'Flip',
  remove: 'Remove',
  roomReset: 'Reset room',
  roomResetConfirm: 'Reset the room to its original look?',
  roomExport: 'Save room photo',
  roomExportTitle: 'Save room photo',
  goCloset: 'Change outfit',
  roomFull: 'Too many items (max {n})',
  roomResetDone: 'Room has been reset',
  dragHint: 'Hold a piece and drag it onto the avatar',
  tweakHint: 'Tap a piece, drag to move, pinch to resize',
  tweakAria: 'Adjust worn clothes. Arrow keys move, +/- resize, 0 resets, Delete takes off',
  tweakReset: 'Reset',
  takeOff: 'Take off',
  dropHere: 'Drop here',
  modeAssemble: 'Mix',
  partHead: 'Hair',
  partTop: 'Tops',
  partBottom: 'Bottoms',
  assembleHint: 'Pick hair, top and bottom separately',
  assembleTopHint: 'Each top includes the arms and hands',
  noBottoms: 'No bottoms yet',
}

export const MESSAGES: Record<Lang, Dict> = { ko, en }

export const CATEGORY_LABEL: Record<Lang, Record<Category, string>> = {
  ko: { top: '상의', bottom: '하의', dress: '원피스', outer: '아우터', shoes: '신발', accessory: '액세서리', bag: '가방' },
  en: { top: 'Tops', bottom: 'Bottoms', dress: 'Dresses', outer: 'Outerwear', shoes: 'Shoes', accessory: 'Accessories', bag: 'Bags' },
}

export const BG_LABEL: Record<Lang, Record<string, string>> = {
  ko: {
    cream: '크림', pink: '핑크', mint: '민트', sky: '하늘', lilac: '라일락', lemon: '레몬',
    sunset: '노을', ocean: '바다', dream: '드림', 'dots-pink': '핑크 도트', 'dots-mint': '민트 도트',
    stripes: '스트라이프', transparent: '투명',
  },
  en: {
    cream: 'Cream', pink: 'Pink', mint: 'Mint', sky: 'Sky', lilac: 'Lilac', lemon: 'Lemon',
    sunset: 'Sunset', ocean: 'Ocean', dream: 'Dream', 'dots-pink': 'Pink dots', 'dots-mint': 'Mint dots',
    stripes: 'Stripes', transparent: 'Transparent',
  },
}

export function detectLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export interface I18n {
  lang: Lang
  t: (key: keyof Dict, vars?: Record<string, string | number>) => string
}

export const I18nContext = createContext<I18n>({
  lang: 'ko',
  t: (k) => ko[k],
})

export const useI18n = () => useContext(I18nContext)

export function makeT(lang: Lang): I18n['t'] {
  return (key, vars) => {
    let s: string = MESSAGES[lang][key]
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
    return s
  }
}
