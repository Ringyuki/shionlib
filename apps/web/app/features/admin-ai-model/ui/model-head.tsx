import { DropdownMenu, DropdownMenuItem, Switch, Tag, Text, toast } from '@hina-ui/react'
import { Ellipsis, Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { aiPaths, DetailHead, tokenCount } from '~/features/admin-ai'
import { IconButton } from '~/shared/ui/button'
import { capabilities, identifierOf, type Model } from '../admin-ai-model'
import { useModelChange } from '../use-model-change'

type ModelHeadProps = {
  model: Model
  editable: boolean
  onRemove: () => void
}

export function ModelHead({ model, editable, onRemove }: ModelHeadProps) {
  const t = useTranslations('adminAiModel')
  const kinds = useTranslations('adminAi.capability')
  const change = useModelChange()
  const submitted =
    change.submitted?.action === 'update' ? change.submitted.changes.enabled : undefined
  const facts = [
    model.context_limit === null
      ? undefined
      : t('context', { size: tokenCount(model.context_limit) }),
    model.output_limit === null ? undefined : t('output', { size: tokenCount(model.output_limit) }),
    capabilities
      .filter(capability => model[capability])
      .map(capability => kinds(capability))
      .join(t('separator')),
  ].flatMap(fact => (fact === undefined || fact === '' ? [] : [fact]))
  return (
    <DetailHead
      back={{ to: aiPaths.models, label: t('title') }}
      heading={model.name}
      mark={model.is_default ? <Tag tone="accent">{t('default')}</Tag> : undefined}
      facts={
        <>
          <Text as="span" size="inherit" className="font-mono">
            {identifierOf(model)}
          </Text>
          {facts.map(fact => t('fact', { fact })).join('')}
        </>
      }
      actions={
        <>
          <Switch
            disabled={!editable || change.pending}
            checked={change.pending && submitted !== undefined ? submitted : model.enabled}
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
          >
            {t('column.enabled')}
          </Switch>
          <DropdownMenu
            label={t('menu')}
            align="end"
            content={
              <DropdownMenuItem
                icon={<Trash2 />}
                tone="danger"
                disabled={!editable || model.is_default}
                onSelect={onRemove}
              >
                {t('remove.open')}
              </DropdownMenuItem>
            }
          >
            <IconButton variant="ghost" tone="neutral" label={t('menu')} tooltip={false}>
              <Ellipsis />
            </IconButton>
          </DropdownMenu>
        </>
      }
    />
  )
}
