import { Grid, Stack, Stepper, type FormHandle } from '@hina-ui/react'
import { useRef } from 'react'
import { useTranslations } from 'use-intl'
import type { GameHeader } from '~/features/game'
import type { Allowance } from '~/features/upload'
import {
  inputPhase,
  stepAllowed,
  stepReady,
  wizardSteps,
  type Composer,
} from '../resource-composition'
import { useComposerRefresh } from '../use-composer-refresh'
import { useCompositionTransfer } from '../use-composition-transfer'
import { useCompositionWizard } from '../use-composition-wizard'
import { CompositionActions } from './composition-actions'
import { CompositionBaseStep } from './composition-base'
import { CompositionExtrasStep } from './composition-extras'
import { CompositionFilesStep } from './composition-files'
import { CompositionPatchStep } from './composition-patch'
import { CompositionSummary } from './composition-summary'

type CompositionWizardProps = {
  game: GameHeader | null
  allowance: Allowance
  composer: Composer
}

export function CompositionWizard({ game, allowance, composer }: CompositionWizardProps) {
  const t = useTranslations('resource.composition')
  const { composition, bases } = composer
  const wizard = useCompositionWizard(composer, game?.id)
  const patch = useCompositionTransfer(composition?.id, 'patch')
  const save = useCompositionTransfer(composition?.id, 'save')
  const patchPhase = inputPhase(composition?.patch ?? null, patch.transfer)
  const savePhase = inputPhase(composition?.save ?? null, save.transfer)
  const form = useRef<FormHandle>(null)
  useComposerRefresh(patchPhase.name === 'reading' || savePhase.name === 'reading')
  const { step } = wizard
  const ready = stepReady(step, composition, wizard.base, patchPhase, savePhase)
  const next = () => {
    switch (step) {
      case 'base':
        return void wizard.leaveBase()
      case 'patch':
        return void form.current?.submit()
      case 'files':
        return wizard.leaveFiles()
      case 'extras':
        return void wizard.start()
    }
  }
  return (
    <Grid className="items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <Stack gap="xl" className="min-w-0">
        <Stepper
          label={t('stepper')}
          items={wizardSteps.map(item => ({
            title: t(`steps.${item}`),
            disabled: !stepAllowed(item, composition),
          }))}
          value={wizard.stepIndex + 1}
          beforeChange={(target, current) => target < current}
          onValueChange={target => wizard.back(wizardSteps[target - 1] ?? 'base')}
        />
        {step === 'base' || composition === null ? (
          <CompositionBaseStep
            game={game}
            bases={bases}
            chosen={wizard.base}
            onChoose={wizard.chooseBase}
            onGame={id => void wizard.pickGame(id)}
            onUpload={wizard.switchToUpload}
          />
        ) : step === 'patch' ? (
          <CompositionPatchStep
            composition={composition}
            values={wizard.details}
            form={form}
            patch={patch}
            onValuesChange={wizard.changeDetails}
            onRemove={wizard.removePatch}
            onSubmit={() => void wizard.leavePatch()}
          />
        ) : step === 'files' ? (
          <CompositionFilesStep
            composition={composition}
            patch={patchPhase}
            pending={wizard.pending}
            onPlace={wizard.place}
          />
        ) : (
          <CompositionExtrasStep
            composition={composition}
            save={save}
            keepPatch={wizard.keepPatch}
            onKeepPatch={keep => void wizard.changeKeepPatch(keep)}
            onRemoveSave={wizard.removeSave}
          />
        )}
        <CompositionActions
          step={step}
          ready={ready}
          pending={wizard.pending}
          onBack={() =>
            step === 'base'
              ? void wizard.cancel()
              : wizard.back(wizardSteps[wizard.stepIndex - 1] ?? 'base')
          }
          onNext={next}
        />
      </Stack>
      <CompositionSummary
        game={game}
        allowance={allowance}
        base={bases.find(base => base.resource_id === wizard.base)}
        composition={composition}
        patch={patchPhase}
        last={step === 'extras'}
        keepPatch={wizard.keepPatch}
      />
    </Grid>
  )
}
