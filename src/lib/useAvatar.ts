import { useSyncExternalStore } from 'react'
import { avatarVersion, getAvatar, subscribeAvatar } from './avatars'

/** 지금 고른 아바타 (바뀌면 이 훅을 쓰는 화면이 다시 그려진다) */
export function useAvatar() {
  useSyncExternalStore(subscribeAvatar, avatarVersion)
  return getAvatar()
}
