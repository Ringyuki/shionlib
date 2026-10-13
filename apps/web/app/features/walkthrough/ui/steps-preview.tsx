import { cn, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { rowsOf, type Route } from '../walkthrough'
import { StepRows } from './step-rows'

type StepsPreviewProps = { routes: readonly Route[]; index: number; className?: string }

export function StepsPreview({ routes, index, className }: StepsPreviewProps) {
  const t = useTranslations('walkthrough')
  return (
    <Stack gap="none" className={cn('gap-1.5', className)}>
      <Text as="span" size="sm" weight="medium" className="flex min-h-8 items-center">
        {t('preview')}
      </Text>
      <Stack
        gap="none"
        aria-label={t('preview')}
        className="bg-subtle min-h-63 rounded-lg px-5 py-1.5"
      >
        <StepRows rows={rowsOf(routes, index)} />
      </Stack>
    </Stack>
  )
}
