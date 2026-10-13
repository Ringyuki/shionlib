import { Heading, Inline, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import { runStatus, type Composition } from '../resource-composition'
import { CompositionTag } from './composition-tag'

export function ComposingFile({ composition }: { composition: Composition }) {
  const t = useTranslations('resource.composition')
  const bytes = useBytes()
  return (
    <Stack gap="xs" className="min-w-0">
      <Heading level={1} size="lg" className="break-words">
        {composition.file_name}
      </Heading>
      <Inline gap="sm" align="center" className="gap-y-1">
        <Text as="span" size="sm" className="tabular-nums">
          {t('summary.estimate', { size: bytes(composition.estimated_size) })}
        </Text>
        <CompositionTag status={runStatus(composition) ?? 'running'} />
      </Inline>
    </Stack>
  )
}
