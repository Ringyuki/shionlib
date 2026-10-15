import { Progress, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useElapsed } from '../use-elapsed'
import { elapsedText } from '../walkthrough-format'

export function FormatProgress({ since }: { since: number | undefined }) {
  const t = useTranslations('walkthrough.format')
  const elapsed = useElapsed(since)
  return (
    <Stack gap="none" align="center" aria-busy className="gap-2.5 pt-5 pb-4 text-center">
      <Progress aria-label={t('working')} className="mb-2.5 w-full max-w-90" />
      <Text weight="medium">{t('working')}</Text>
      <Text tone="muted" size="sm" className="tabular-nums">
        {t('elapsed', { time: elapsedText(elapsed) })}
      </Text>
      <Text tone="muted" size="xs">
        {t('hint')}
      </Text>
    </Stack>
  )
}
