import { useSyncExternalStore } from 'react'
import { itemsVersion, subscribeItems } from './items'

/** 내 옷이 추가·삭제되면 다시 그리도록 컴포넌트를 깨운다 */
export const useItemsVersion = () => useSyncExternalStore(subscribeItems, itemsVersion)
