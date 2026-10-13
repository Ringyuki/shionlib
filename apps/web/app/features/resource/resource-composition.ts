import type { Schema } from '~/shared/api/types'
import type { Language } from './resource'
import { blankInfo, translationOptions, type InfoValues, type Translation } from './resource-info'

export type Composition = Schema<'CompositionDTO'>

export type CompositionBase = Schema<'CompositionBaseDTO'>

export type CompositionPlan = Schema<'CompositionPlanDTO'>

export type CompositionInput = Schema<'CompositionInputDTO'>

export type CompositionDir = Schema<'CompositionDirDTO'>

export type CompositionMatch = Schema<'CompositionMatchDTO'>

export type CompositionLineage = Schema<'CompositionLineageDTO'>

export type CompositionOrigin = Schema<'CompositionOriginDTO'>

export type RunStep = Schema<'CompositionStepDTO'>

export type Failure = NonNullable<Composition['failure']>

export type Unusable = NonNullable<CompositionBase['reason']>

export const composerRefreshEvery = 2_000

export const runRefreshEvery = 5_000

export const wizardSteps = ['base', 'patch', 'files', 'extras'] as const

export type WizardStep = (typeof wizardSteps)[number]

export const composeModes = ['upload', 'compose'] as const

export type ComposeMode = (typeof composeModes)[number]

export type Composer = {
  composition: Composition | null
  bases: CompositionBase[]
  step: WizardStep
}

export type Transfer = { name: string; size: number; percent: number; failed: boolean }

export type InputPhase =
  | { name: 'empty' }
  | { name: 'uploading'; percent: number }
  | { name: 'failed' }
  | { name: 'reading'; input: CompositionInput }
  | { name: 'ready'; input: CompositionInput }
  | { name: 'refused'; input: CompositionInput }

export type Change = { path: string; size: number; oldSize: number | null }

export type DirChoice = { path: string; items: number; depth: number }

export type RunStatus = 'queued' | 'running' | 'failed'

export function stepAllowed(step: WizardStep, composition: Composition | null): boolean {
  switch (step) {
    case 'base':
      return true
    case 'patch':
      return composition !== null
    case 'files':
      return composition?.patch !== null && composition?.patch !== undefined
    case 'extras':
      return planReady(composition)
  }
}

export function reachedStep(wanted: WizardStep | undefined, composition: Composition | null) {
  const chosen = wanted ?? (composition === null ? 'base' : 'patch')
  const allowed = wizardSteps.filter(step => stepAllowed(step, composition))
  return allowed.includes(chosen) ? chosen : (allowed.at(-1) ?? 'base')
}

export function planReady(composition: Composition | null): boolean {
  return composition?.patch?.state === 'ready' && composition.plan !== null
}

export function inputPhase(input: CompositionInput | null, transfer?: Transfer): InputPhase {
  if (transfer !== undefined) {
    return transfer.failed ? { name: 'failed' } : { name: 'uploading', percent: transfer.percent }
  }
  if (input === null) {
    return { name: 'empty' }
  }
  return { name: input.state, input }
}

export function placeable(composition: Composition | null): boolean {
  const plan = composition?.plan ?? null
  return (
    planReady(composition) &&
    plan !== null &&
    (plan.conflicts ?? []).length === 0 &&
    plan.adds.files + plan.replaces.files > 0
  )
}

export function startable(composition: Composition): boolean {
  const { save } = composition
  return (
    placeable(composition) &&
    (save === null || save.state === 'ready') &&
    (composition.details.language ?? []).length > 0
  )
}

const usablePatch: readonly InputPhase['name'][] = ['uploading', 'reading', 'ready']

export function stepReady(
  step: WizardStep,
  composition: Composition | null,
  base: number | undefined,
  patch: InputPhase,
  save: InputPhase,
): boolean {
  switch (step) {
    case 'base':
      return base !== undefined
    case 'patch':
      return usablePatch.includes(patch.name)
    case 'files':
      return placeable(composition)
    case 'extras':
      return composition !== null && startable(composition) && save.name !== 'uploading'
  }
}

export function changesOf(plan: CompositionPlan): Change[] {
  const changed = [...(plan.added ?? []), ...(plan.replaced ?? [])]
  return changed
    .map(change => ({ path: change.path, size: change.size, oldSize: change.old_size }))
    .sort((a, b) => byPath(a.path, b.path))
}

function byPath(a: string, b: string): number {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  return left < right ? -1 : left > right ? 1 : 0
}

export function unlistedChanges(plan: CompositionPlan): number {
  const listed = (plan.added ?? []).length + (plan.replaced ?? []).length
  return Math.max(0, plan.adds.files + plan.replaces.files - listed)
}

export function dirChoices(dirs: readonly CompositionDir[] | null): DirChoice[] {
  return (dirs ?? []).map(dir => ({
    path: dir.path,
    items: dir.items,
    depth: dir.path === '' ? 0 : dir.path.split('/').length,
  }))
}

export function folderName(path: string): string {
  return path.split('/').at(-1) ?? path
}

export function runStatus(composition: Pick<Composition, 'state'>): RunStatus | undefined {
  switch (composition.state) {
    case 'queued':
    case 'running':
    case 'failed':
      return composition.state
    case 'draft':
    case 'done':
      return undefined
  }
}

export function runningStep(composition: Pick<Composition, 'step' | 'steps'>) {
  const steps = composition.steps ?? []
  const index = steps.findIndex(step => step.step === composition.step)
  const step = steps[index]
  return step === undefined ? undefined : { at: index + 1, total: steps.length, step: step.step }
}

export function usableBases(bases: readonly CompositionBase[]): CompositionBase[] {
  return bases.filter(base => base.reason === null)
}

export function usableFirst(bases: readonly CompositionBase[]): CompositionBase[] {
  return [...bases].sort((a, b) => Number(a.reason !== null) - Number(b.reason !== null))
}

export function onlyDiscs(bases: readonly CompositionBase[]): boolean {
  return bases.length > 0 && bases.every(base => base.reason === 'disc')
}

export type ComposedTranslation = Exclude<Translation, 'none'>

export const composedTranslations = translationOptions.filter(
  (option): option is ComposedTranslation => option !== 'none',
)

export type DetailValues = InfoValues & { language: Language[] }

export const blankDetails: DetailValues = { ...blankInfo, form: 'portable', language: [] }

export function detailValuesFrom(details: Composition['details']): DetailValues {
  return {
    ...blankDetails,
    language: [...(details.language ?? [])],
    translation:
      details.translation === null || details.translation === 'none' ? '' : details.translation,
    translators: [...(details.translators ?? [])],
    patchVersion: details.patch_version ?? '',
    releaseUrl: details.release_url ?? '',
  }
}

export function matchedValues(
  values: DetailValues,
  match: CompositionMatch | null,
): DetailValues | undefined {
  const translators = match?.translators ?? []
  if (match === null || (values.translators.length > 0 && values.releaseUrl !== '')) {
    return undefined
  }
  return {
    ...values,
    translation: translators.length > 0 && values.translation === '' ? 'group' : values.translation,
    translators: values.translators.length > 0 ? values.translators : translators,
    patchVersion: values.patchVersion === '' ? (match.version ?? '') : values.patchVersion,
    releaseUrl: values.releaseUrl === '' ? match.url : values.releaseUrl,
  }
}
