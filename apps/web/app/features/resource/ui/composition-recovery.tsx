import { Inline, Popconfirm } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { Composition } from '../resource-composition'
import { useCompositionCommand } from '../use-composition-command'

export function CompositionRecovery({ composition }: { composition: Composition }) {
  const t = useTranslations('resource.composition')
  const command = useCompositionCommand()
  const compositionId = composition.id
  return (
    <Inline gap="sm" align="center">
      <Button
        variant="outline"
        size="sm"
        loading={command.pending}
        onClick={() => void command.run({ intent: 'retry', compositionId })}
      >
        {t('retry')}
      </Button>
      <Popconfirm
        title={t('discardConfirm')}
        description={t(composition.rebuild ? 'discardRebuild' : 'discardResource')}
        tone="danger"
        onConfirm={() => command.confirm({ intent: 'discard', compositionId })}
      >
        <Button variant="ghost" tone="neutral" size="sm" disabled={command.pending}>
          {t('discard')}
        </Button>
      </Popconfirm>
    </Inline>
  )
}
