import { useMemo, useSyncExternalStore } from 'react'
import { readLocal, writeLocal } from '~/shared/storage/local-storage'
import { downloadSettingsKey, type DownloadSettings } from './download'
import { downloadSettingsFrom } from './download.schema'

const changed = 'shionlib:download-settings'

const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify)
  window.addEventListener(changed, notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener(changed, notify)
  }
}

const stored = () => readLocal(downloadSettingsKey, value => value)

const nothingStored = () => null

export function useDownloadSettings() {
  const raw = useSyncExternalStore(subscribe, stored, nothingStored)
  const settings = useMemo(() => downloadSettingsFrom(raw), [raw])
  const save = (next: DownloadSettings) => {
    writeLocal(downloadSettingsKey, next)
    window.dispatchEvent(new Event(changed))
  }
  return { settings, save }
}
