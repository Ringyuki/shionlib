import { Inline, Switch, Tag, Text, toast } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { aiPaths, Capabilities, missing, tokenCount, useAiFormat } from '~/features/admin-ai'
import { identifierOf, providersOf, type Model } from '../admin-ai-model'
import { useModelChange } from '../use-model-change'
import { RouteChain } from './route-chain'

type ModelTableProps = {
  models: Model[]
  filtered: boolean
  editable: boolean
  note: ReactNode
}

export function ModelTable({ models, filtered, editable, note }: ModelTableProps) {
  const t = useTranslations('adminAiModel')
  const format = useAiFormat()
  const navigate = useNavigate()
  const change = useModelChange()
  const toggled =
    change.submitted?.action === 'update' && change.pending ? change.submitted : undefined
  const columns: RecordColumn[] = [
    { key: 'model', label: t('column.model'), fill: true },
    { key: 'capabilities', label: t('column.capabilities'), wide: true },
    { key: 'routes', label: t('column.routes'), wide: true },
    { key: 'context', label: t('column.context'), align: 'end', wide: true },
    { key: 'requests', label: t('column.requests'), align: 'end', wide: true },
    { key: 'failureRate', label: t('column.failureRate'), align: 'end', wide: true },
    { key: 'cost', label: t('column.cost'), align: 'end', wide: true },
    { key: 'enabled', label: t('column.enabled') },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={models}
      rowKey={model => model.id}
      columns={columns}
      empty={t('empty', { filtered: String(filtered) })}
      onOpen={model => void navigate(aiPaths.model(model.id))}
      footer={
        <Text as="span" size="sm" tone="muted">
          {note}
        </Text>
      }
      renderCell={(model, column) => {
        switch (column) {
          case 'model':
            return (
              <TwoLines
                mono
                first={
                  <Inline as="span" gap="sm" align="center">
                    {model.name}
                    {model.is_default && <Tag tone="accent">{t('default')}</Tag>}
                  </Inline>
                }
                second={identifierOf(model)}
                narrow={providersOf(model).join(t('then'))}
              />
            )
          case 'capabilities':
            return <Capabilities of={model} />
          case 'routes':
            return <RouteChain model={model} />
          case 'context':
            return model.context_limit === null ? missing : tokenCount(model.context_limit)
          case 'requests':
            return format.count(model.stats.requests)
          case 'failureRate':
            return format.rate(model.stats)
          case 'cost':
            return format.usd(model.stats.cost_usd)
          default:
            return (
              <Switch
                aria-label={t('enable', { name: model.name })}
                disabled={!editable || change.pending}
                checked={
                  toggled?.id === model.id
                    ? (toggled.changes.enabled ?? model.enabled)
                    : model.enabled
                }
                onCheckedChange={async enabled => {
                  const outcome = await change.run({
                    action: 'update',
                    id: model.id,
                    changes: { enabled },
                  })
                  if (outcome.ok) {
                    toast.success(t(enabled ? 'enabled' : 'disabled', { name: model.name }))
                  }
                }}
              />
            )
        }
      }}
    />
  )
}
