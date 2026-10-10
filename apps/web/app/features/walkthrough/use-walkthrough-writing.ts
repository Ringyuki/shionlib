import { toast } from '@hina-ui/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { fieldMessages } from '~/shared/api/error'
import { useFormKit } from '~/shared/form/use-form-kit'
import { useLeaveGuard } from '~/shared/route/use-leave-guard'
import { stateOf, walkthroughsPath, type Face, type WalkthroughState } from './walkthrough'
import {
  draftOf,
  sameDraft,
  withoutRoute,
  withRoute,
  withRouteChanged,
  withRouteMoved,
  writtenOf,
  type Draft,
  type RouteDraft,
} from './walkthrough-draft'
import {
  refusedFrom,
  routeErrors,
  routeForm,
  type RouteErrors,
  type RouteIssue,
} from './walkthrough.schema'
import type { Writing } from './walkthrough.use-cases'
import { useWalkthroughSave } from './use-walkthrough-save'

export type Flagged = { key: string; errors: RouteErrors } | { key: undefined; note: string }

export function useWalkthroughWriting(writing: Writing, faces: readonly Face[]) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const navigate = useNavigate()
  const kit = useFormKit()
  const save = useWalkthroughSave()
  const naming = { faces, separator: t('nameSeparator') }
  const words = { save: t('insert.save'), load: t('insert.load') }
  const [stored, setStored] = useState(() => draftOf(writing.stored, naming, words))
  const [draft, setDraft] = useState(stored)
  const [state, setState] = useState<WalkthroughState>(
    writing.stored === undefined ? 'draft' : stateOf(writing.stored),
  )
  const [walkthroughId, setWalkthroughId] = useState(writing.stored?.id)
  const [shown, setShown] = useState(() => stored.routes[0]?.key)
  const [flagged, setFlagged] = useState<Flagged | undefined>(undefined)
  const guard = useLeaveGuard(!sameDraft(draft, stored))
  const issue = (found: RouteIssue) => t(`issue.${found.kind}`, found)
  const flag = (index: number, errors: RouteErrors) => {
    const key = draft.routes[index]?.key
    if (key !== undefined) {
      setShown(key)
      setFlagged({ key, errors })
    }
  }
  const submit = async (publish: boolean) => {
    const form = routeForm(kit, issue, publish)
    const found = draft.routes.map(route => routeErrors(form, route))
    const invalid = found.findIndex(errors => Object.keys(errors).length > 0)
    if (invalid !== -1) {
      flag(invalid, found[invalid] ?? {})
      return
    }
    const written = draft
    const outcome = await save.run({ gameId: writing.game.id, ...writtenOf(written), publish })
    if (!outcome.ok) {
      const refused = refusedFrom(fieldMessages(outcome.failure))
      if (refused?.part === 'note') {
        setFlagged({ key: undefined, note: refused.message })
      } else if (refused !== undefined) {
        flag(refused.part, refused.errors)
      }
      return
    }
    setStored(written)
    setState(outcome.result.state)
    setWalkthroughId(outcome.result.id)
    if (!publish) {
      toast.success(t('draftSaved'))
      return
    }
    guard.release()
    toast.success(t(outcome.result.state === 'published' ? 'published' : 'sentForReview'))
    void navigate(walkthroughsPath(locale, writing.game.id))
  }
  return {
    draft,
    shown,
    flagged,
    state,
    walkthroughId,
    naming,
    words,
    guard,
    saving: save.pending,
    show: setShown,
    writeNote: (written: Draft['note']) => setDraft(current => ({ ...current, note: written })),
    change: (key: string, change: (route: RouteDraft) => RouteDraft) =>
      setDraft(current => withRouteChanged(current, key, change)),
    add: () => {
      const grown = withRoute(draft)
      const added = grown.routes.at(-1)
      setDraft(grown)
      setShown(added?.key)
    },
    remove: (key: string) => {
      const left = withoutRoute(draft, key)
      setDraft(left)
      setShown(left.routes[0]?.key)
    },
    move: (key: string, over: string) => setDraft(current => withRouteMoved(current, key, over)),
    saveDraft: () => submit(false),
    publish: () => submit(true),
    leaveAfterRemoval: () => {
      guard.release()
      void navigate(walkthroughsPath(locale, writing.game.id))
    },
  }
}
