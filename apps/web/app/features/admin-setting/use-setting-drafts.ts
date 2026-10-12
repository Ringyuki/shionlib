import { useState } from 'react'
import { useLeaveGuard } from '~/shared/route/use-leave-guard'
import {
  drafted,
  edited,
  problemOf,
  savesOf,
  shownValue,
  type Draft,
  type Setting,
  type Value,
} from './admin-setting'
import { useSettingSave } from './use-setting-save'

export function useSettingDrafts(settings: readonly Setting[]) {
  const [draft, setDraft] = useState<Draft>({})
  const save = useSettingSave()
  const changed = edited(settings, draft)
  const guard = useLeaveGuard(changed.length > 0)
  return {
    draft,
    changed,
    guard,
    saving: save.pending,
    blocked: changed.some(setting => problemOf(setting, shownValue(setting, draft)) !== undefined),
    change: (setting: Setting, value: Value) =>
      setDraft(current => drafted(current, setting, value)),
    discard: () => setDraft({}),
    save: async () => {
      const outcome = await save.run({ changes: savesOf(settings, draft) })
      if (outcome.ok) {
        setDraft({})
      }
      return outcome.ok
    },
  }
}

export type SettingDrafts = ReturnType<typeof useSettingDrafts>
