import { useMemo, useSyncExternalStore } from 'react'
import { readLocal } from '~/shared/storage/local-storage'
import { downloadSettingsKey } from './download'
import { downloadSettingsFrom } from './download.schema'

const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify)
  return () => window.removeEventListener('storage', notify)
}

const stored = () => readLocal(downloadSettingsKey, value => value)

const nothingStored = () => null

export function useDownloadSettings() {
  const raw = useSyncExternalStore(subscribe, stored, nothingStored)
  return useMemo(() => downloadSettingsFrom(raw), [raw])
}
