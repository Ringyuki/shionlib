import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useLocale } from 'use-intl'
import { sitePaths } from '~/features/shell'
import {
  blankDetails,
  detailValuesFrom,
  matchedValues,
  usableBases,
  wizardSteps,
  type Composer,
  type DetailValues,
  type WizardStep,
} from './resource-composition'
import type { CompositionEdit } from './resource-composition.schema'
import { useCompositionCommand } from './use-composition-command'

type Placement = Pick<CompositionEdit, 'gameDir' | 'patchDir'>

export function useCompositionWizard(composer: Composer, gameId: number | undefined) {
  const { composition, bases, step } = composer
  const [, setParams] = useSearchParams()
  const navigate = useNavigate()
  const locale = useLocale()
  const command = useCompositionCommand()
  const usable = usableBases(bases)
  const [base, setBase] = useState(
    composition?.base.resource_id ?? (usable.length === 1 ? usable[0]?.resource_id : undefined),
  )
  const [details, setDetails] = useState<DetailValues>(() =>
    composition === null ? blankDetails : detailValuesFrom(composition.details),
  )
  const [keepPatch, setKeepPatch] = useState(composition?.keep_patch ?? true)
  const matched = useRef<string | undefined>(undefined)
  const match = composition?.match ?? null
  useEffect(() => {
    if (match !== null && matched.current !== match.url) {
      matched.current = match.url
      setDetails(current => matchedValues(current, match) ?? current)
    }
  }, [match])
  const go = (next: WizardStep, id = composition?.id) => {
    setParams(params => {
      params.set('mode', 'compose')
      params.set('step', next)
      if (id !== undefined) {
        params.set('composition', String(id))
      }
      return params
    })
  }
  const edit = (placement: Placement = {}, keep = keepPatch) => {
    if (composition === null) {
      return Promise.resolve(false)
    }
    return command
      .run({
        intent: 'edit',
        compositionId: composition.id,
        language: details.language,
        translation: details.translation === 'none' ? '' : details.translation,
        translators: details.translators,
        patchVersion: details.patchVersion,
        releaseUrl: details.releaseUrl,
        keepPatch: keep,
        ...placement,
      })
      .then(outcome => outcome.ok)
  }
  return {
    step,
    stepIndex: wizardSteps.indexOf(step),
    pending: command.pending,
    base,
    chooseBase: setBase,
    details,
    changeDetails: setDetails,
    keepPatch,
    async changeKeepPatch(keep: boolean) {
      setKeepPatch(keep)
      await edit({}, keep)
    },
    back(to: WizardStep) {
      go(to)
    },
    async leaveBase() {
      if (base === undefined || gameId === undefined) {
        return
      }
      if (composition?.base.resource_id === base) {
        go('patch')
        return
      }
      const outcome = await command.run({
        intent: 'begin',
        gameId,
        baseResourceId: base,
        replacing: composition?.id,
      })
      if (outcome.ok && outcome.result !== null) {
        go('patch', outcome.result.id)
      }
    },
    async leavePatch() {
      if (await edit()) {
        go('files')
      }
    },
    place: (placement: Placement) => edit(placement),
    leaveFiles() {
      go('extras')
    },
    async start() {
      if (composition === null || !(await edit())) {
        return
      }
      const outcome = await command.run({ intent: 'start', compositionId: composition.id })
      if (outcome.ok) {
        void navigate(`${sitePaths(locale).uploads}?status=processing`)
      }
    },
    async pickGame(id: number | undefined) {
      if (composition !== null) {
        await command.run({ intent: 'discard', compositionId: composition.id })
      }
      setParams(id === undefined ? { mode: 'compose' } : { mode: 'compose', game: String(id) })
    },
    switchToUpload() {
      setParams(gameId === undefined ? {} : { game: String(gameId) })
    },
    async cancel() {
      if (composition !== null) {
        await command.run({ intent: 'discard', compositionId: composition.id })
      }
      setParams(gameId === undefined ? {} : { game: String(gameId) })
    },
    removeSave() {
      if (composition !== null) {
        void command.run({ intent: 'detach', compositionId: composition.id, role: 'save' })
      }
    },
    removePatch() {
      if (composition !== null) {
        void command.run({ intent: 'detach', compositionId: composition.id, role: 'patch' })
      }
    },
  }
}

export type CompositionWizard = ReturnType<typeof useCompositionWizard>
