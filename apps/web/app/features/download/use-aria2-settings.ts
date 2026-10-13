import { useState } from 'react'
import type { DownloadSettings } from './download'
import { aria2TargetFrom, type Aria2Values } from './download.schema'
import { storeDownloadSettings } from './use-download-settings'

export function useAria2Settings(settings: DownloadSettings) {
  const [draft, setDraft] = useState<string>()
  const values: Aria2Values = { ...settings.aria2, endpoint: draft ?? settings.aria2.endpoint }
  const change = (patch: Partial<Aria2Values>) => {
    const wanted = { ...values, ...patch }
    const valid = aria2TargetFrom(wanted)
    setDraft(valid === undefined ? wanted.endpoint : undefined)
    storeDownloadSettings({
      ...settings,
      aria2: valid ?? { ...wanted, endpoint: settings.aria2.endpoint },
    })
  }
  return { values, change }
}
