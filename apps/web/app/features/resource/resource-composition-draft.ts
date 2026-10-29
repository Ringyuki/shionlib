import { stepAllowed, wizardSteps, type Composition, type WizardStep } from './resource-composition'

type Drafted = Pick<Composition, 'state' | 'resource_id' | 'game_id'>

export function unstartedDrafts<Draft extends Drafted>(compositions: readonly Draft[]): Draft[] {
  return compositions.filter(
    composition => composition.state === 'draft' && composition.resource_id === null,
  )
}

export function draftsOfGame<Draft extends Drafted>(
  compositions: readonly Draft[],
  gameId: number,
): Draft[] {
  return unstartedDrafts(compositions).filter(composition => composition.game_id === gameId)
}

export function resumeStep(composition: Composition): WizardStep {
  return wizardSteps.filter(step => stepAllowed(step, composition)).at(-1) ?? 'base'
}

export function resumeSearch(composition: Composition): string {
  const params = new URLSearchParams({
    mode: 'compose',
    game: String(composition.game_id),
    composition: String(composition.id),
    step: resumeStep(composition),
  })
  return `?${params.toString()}`
}
