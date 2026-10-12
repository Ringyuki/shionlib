import { Inline, Select, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { errorKinds, useAiFormat } from '~/features/admin-ai'
import {
  everySource,
  fromSourceChoice,
  results,
  sceneChoice,
  sourceChoice,
  type Filter,
  type Narrowing,
  type Summary,
} from '../admin-ai-request'
import type { Listing } from '../admin-ai-request.use-cases'

type RequestsToolbarProps = Pick<Listing, 'scenes' | 'models' | 'providers'> & {
  filter: Filter
  summary: Summary
  onShow: (changes: Partial<Narrowing>) => void
}

const every = 'all'

export function RequestsToolbar(props: RequestsToolbarProps) {
  const { filter, summary, scenes, models, providers, onShow } = props
  const t = useTranslations('adminAiRequest')
  const shared = useTranslations('adminAi')
  const format = useAiFormat()
  const numbered = (value: unknown, known: readonly { id: number }[]) =>
    known.find(item => item.id === value)?.id
  const pick = { size: 'sm', className: 'w-36 max-sm:w-[calc(50%-0.25rem)]' } as const
  return (
    <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
      <Select
        {...pick}
        aria-label={t('filter.source')}
        value={sourceChoice(filter)}
        options={[
          { value: everySource, label: t('filter.allSources') },
          ...scenes.map(scene => ({ value: sceneChoice(scene.key), label: scene.label })),
          { value: 'check', label: shared('source.check') },
          { value: 'playground', label: shared('source.playground') },
        ]}
        onValueChange={value => onShow(fromSourceChoice(String(value)))}
      />
      <Select
        {...pick}
        aria-label={t('filter.model')}
        value={filter.modelId ?? every}
        options={[
          { value: every, label: t('filter.allModels') },
          ...models.map(model => ({ value: model.id, label: model.name })),
        ]}
        onValueChange={value => onShow({ modelId: numbered(value, models) })}
      />
      <Select
        {...pick}
        aria-label={t('filter.provider')}
        value={filter.providerId ?? every}
        options={[
          { value: every, label: t('filter.allProviders') },
          ...providers.map(provider => ({ value: provider.id, label: provider.name })),
        ]}
        onValueChange={value => onShow({ providerId: numbered(value, providers) })}
      />
      <Select
        {...pick}
        aria-label={t('filter.result')}
        value={filter.result ?? every}
        options={[
          { value: every, label: t('filter.allResults') },
          ...results.map(result => ({ value: result, label: t(`result.${result}`) })),
        ]}
        onValueChange={value => onShow({ result: results.find(result => result === value) })}
      />
      <Select
        {...pick}
        aria-label={t('filter.errorKind')}
        value={filter.errorKind ?? every}
        options={[
          { value: every, label: t('filter.allErrorKinds') },
          ...errorKinds.map(kind => ({ value: kind, label: shared(`errorKind.${kind}`) })),
        ]}
        onValueChange={value => onShow({ errorKind: errorKinds.find(kind => kind === value) })}
      />
      <Text as="span" size="sm" tone="muted" className="ms-auto tabular-nums">
        {t('summary', {
          requests: summary.stats.requests,
          failures: summary.stats.failures,
          cost: format.usd(summary.stats.cost_usd),
        })}
      </Text>
    </Inline>
  )
}
