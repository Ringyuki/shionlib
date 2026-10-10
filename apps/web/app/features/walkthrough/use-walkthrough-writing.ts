import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLocale } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { useLeaveGuard } from '~/shared/route/use-leave-guard'
import { useWalkthroughSave } from './use-walkthrough-save'
import {
  isUnsaved,
  walkthroughPath,
  writingPath,
  type Draft,
  type Saved,
  type WalkthroughState,
  type Writing,
} from './walkthrough'

type Stored = Writing & { id: number | undefined; state: WalkthroughState; kept: boolean }

export type Saving = 'draft' | 'publish'

export function useWalkthroughWriting(draft: Draft, adopt: (created: number) => void) {
  const locale = useLocale()
  const navigate = useNavigate()
  const stay = useInPageNavigate()
  const command = useWalkthroughSave()
  const [values, setValues] = useState<Writing>({ title: draft.title, content: draft.content })
  const [saving, setSaving] = useState<Saving | undefined>(undefined)
  const [stored, setStored] = useState<Stored>({
    id: draft.walkthroughId,
    state: draft.state,
    title: draft.title,
    content: draft.content,
    kept: false,
  })
  const unsaved = isUnsaved(values, stored)
  const guard = useLeaveGuard(unsaved)
  const gameId = draft.game.id
  const save = async (publish: boolean): Promise<Saved | undefined> => {
    const written = values
    setSaving(publish ? 'publish' : 'draft')
    const outcome = await command.run({ gameId, walkthroughId: stored.id, publish, ...written })
    setSaving(undefined)
    if (!outcome.ok) {
      return undefined
    }
    const saved = outcome.result
    if (publish) {
      guard.release()
      void navigate(walkthroughPath(locale, gameId, saved.id))
      return saved
    }
    setStored({ ...written, ...saved, kept: true })
    if (stored.id === undefined) {
      adopt(saved.id)
      guard.release()
      stay(writingPath(locale, gameId, saved.id), { replace: true })
    }
    return saved
  }
  return {
    values,
    setValues,
    id: stored.id,
    state: stored.state,
    unsaved,
    kept: stored.kept && !unsaved,
    saving,
    failure: command.failure,
    guard,
    save,
  }
}
