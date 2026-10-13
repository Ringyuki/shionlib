import { Alert, Card, Stack } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { GatewayFrame } from '~/features/admin-ai'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { Button } from '~/shared/ui/button'
import { matching, searchOf, type Filter } from '../admin-ai-provider'
import type { Listing } from '../admin-ai-provider.use-cases'
import { ProviderCreateDialog } from './provider-create-dialog'
import { ProviderTable } from './provider-table'
import { ProvidersToolbar } from './providers-toolbar'

type AiProvidersPageProps = Listing & {
  editable: boolean
}

export function AiProvidersPage({ filter, providers, editable }: AiProvidersPageProps) {
  const t = useTranslations('adminAiProvider')
  const shared = useTranslations('adminAi')
  const stay = useInPageNavigate()
  const [creating, setCreating] = useState(false)
  const show = (changes: Partial<Filter>) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace: true })
  return (
    <GatewayFrame
      tab="providers"
      actions={
        <Button icon={<Plus />} disabled={!editable} onClick={() => setCreating(true)}>
          {t('create.open')}
        </Button>
      }
    >
      <Stack gap="lg">
        <Alert tone="info" open={!editable}>
          {shared('readOnly')}
        </Alert>
        <Card padded={false}>
          <ProvidersToolbar filter={filter} editable={editable} onShow={show} />
          <ProviderTable
            providers={matching(providers, filter)}
            filtered={providers.length > 0}
            editable={editable}
          />
        </Card>
      </Stack>
      <ProviderCreateDialog open={creating} onOpenChange={setCreating} />
    </GatewayFrame>
  )
}
