import { Inline, Spinner, Stack, Text } from '@hina-ui/react'
import { CircleCheck, CircleDashed, CircleX } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { Composition } from '../resource-composition'

type Shown = 'waiting' | 'running' | 'done' | 'failed'

export function CompositionSteps({ composition }: { composition: Composition }) {
  const t = useTranslations('resource.composition')
  const failed = composition.state === 'failed'
  const spent = (seconds: number | null) =>
    seconds === null
      ? ''
      : t('duration', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })
  return (
    <Stack role="list" aria-label={t('stepsLabel')} gap="none" className="max-w-md">
      {(composition.steps ?? []).map(step => {
        const shown: Shown = failed && step.state === 'running' ? 'failed' : step.state
        const measured = shown === 'running' && composition.percent > 0
        return (
          <Inline
            key={step.step}
            role="listitem"
            gap="sm"
            align="center"
            wrap={false}
            className="min-h-8"
          >
            <Marker shown={shown} />
            <Text as="span" tone={shown === 'waiting' ? 'muted' : undefined} className="flex-1">
              {t(`stepName.${step.step}`)}
            </Text>
            <Text as="span" size="sm" tone="muted" className="tabular-nums">
              {measured ? `${composition.percent}%` : spent(step.seconds)}
            </Text>
          </Inline>
        )
      })}
    </Stack>
  )
}

function Marker({ shown }: { shown: Shown }) {
  switch (shown) {
    case 'done':
      return <CircleCheck aria-hidden className="size-4 shrink-0 text-success-text" />
    case 'running':
      return (
        <Inline align="center" justify="center" className="size-4 shrink-0">
          <Spinner size="sm" />
        </Inline>
      )
    case 'failed':
      return <CircleX aria-hidden className="size-4 shrink-0 text-danger-text" />
    case 'waiting':
      return <CircleDashed aria-hidden className="size-4 shrink-0 text-faint" />
  }
}
