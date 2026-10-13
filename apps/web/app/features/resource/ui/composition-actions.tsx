import { Inline } from '@hina-ui/react'
import { ArrowLeft, Combine } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { WizardStep } from '../resource-composition'

type CompositionActionsProps = {
  step: WizardStep
  ready: boolean
  pending: boolean
  onBack: () => void
  onNext: () => void
}

export function CompositionActions({
  step,
  ready,
  pending,
  onBack,
  onNext,
}: CompositionActionsProps) {
  const t = useTranslations('resource.composition')
  const last = step === 'extras'
  return (
    <Inline gap="md" align="center" justify="between">
      {step === 'base' ? (
        <Button variant="ghost" tone="neutral" disabled={pending} onClick={onBack}>
          {t('cancel')}
        </Button>
      ) : (
        <Button
          variant="outline"
          tone="neutral"
          icon={<ArrowLeft />}
          disabled={pending}
          onClick={onBack}
        >
          {t('back')}
        </Button>
      )}
      <Button
        size="lg"
        icon={last ? <Combine /> : undefined}
        loading={pending}
        disabled={!ready}
        onClick={onNext}
      >
        {t(last ? 'start' : 'next')}
      </Button>
    </Inline>
  )
}
