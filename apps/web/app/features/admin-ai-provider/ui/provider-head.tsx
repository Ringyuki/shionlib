import { DropdownMenu, DropdownMenuItem, Switch, toast } from '@hina-ui/react'
import { Ellipsis, Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { aiPaths, DetailHead, officialHosts } from '~/features/admin-ai'
import { IconButton } from '~/shared/ui/button'
import type { Provider } from '../admin-ai-provider'
import { useProviderChange } from '../use-provider-change'

type ProviderHeadProps = {
  provider: Provider
  editable: boolean
  onRemove: () => void
}

export function ProviderHead({ provider, editable, onRemove }: ProviderHeadProps) {
  const t = useTranslations('adminAiProvider')
  const shared = useTranslations('adminAi')
  const change = useProviderChange()
  const submitted =
    change.submitted?.action === 'update' ? change.submitted.changes.enabled : undefined
  return (
    <DetailHead
      back={{ to: aiPaths.providers, label: t('title') }}
      heading={provider.name}
      facts={t('facts', {
        kind: shared(`kind.${provider.kind}`),
        host: provider.base_url ?? officialHosts[provider.kind],
      })}
      actions={
        <>
          <Switch
            disabled={!editable || change.pending}
            checked={change.pending && submitted !== undefined ? submitted : provider.enabled}
            onCheckedChange={async enabled => {
              const outcome = await change.run({
                action: 'update',
                id: provider.id,
                changes: { enabled },
              })
              if (outcome.ok) {
                toast.success(t(enabled ? 'enabled' : 'disabled', { name: provider.name }))
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
                disabled={!editable}
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
