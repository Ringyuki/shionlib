import { Inline, Popconfirm, Stack, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import type { Composition } from '../resource-composition'
import { resumeSearch } from '../resource-composition-draft'
import { useCompositionCommand } from '../use-composition-command'
import { useDiscardTime } from '../use-discard-time'

export function CompositionDraft({ composition }: { composition: Composition }) {
  const t = useTranslations('resource.composition')
  const locale = useLocale()
  const command = useCompositionCommand()
  const discardTime = useDiscardTime()
  const compositionId = composition.id
  return (
    <Stack gap="sm">
      <Text size="sm">{t('discardAt', { time: discardTime(composition) })}</Text>
      <Inline gap="sm" align="center">
        <Button asChild variant="outline" size="sm">
          <RouterLink to={`${sitePaths(locale).upload}${resumeSearch(composition)}`}>
            {t('continue')}
          </RouterLink>
        </Button>
        <Popconfirm
          title={t('discardConfirm')}
          description={t('discardDraft')}
          tone="danger"
          onConfirm={() => command.confirm({ intent: 'discard', compositionId })}
        >
          <Button variant="ghost" tone="neutral" size="sm" disabled={command.pending}>
            {t('discard')}
          </Button>
        </Popconfirm>
      </Inline>
    </Stack>
  )
}
