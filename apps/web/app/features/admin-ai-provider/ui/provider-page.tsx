import { Alert, AlertDialog, Stack, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { aiPaths, GatewayFrame, StatFigures, useAiFormat } from '~/features/admin-ai'
import type { ProviderDetail } from '../admin-ai-provider'
import { useProviderChange } from '../use-provider-change'
import { DiscoveryDialog } from './discovery-dialog'
import { ManualRouteDialog } from './manual-route-dialog'
import { ProviderHead } from './provider-head'
import { ProviderRoutes } from './provider-routes'
import { ProviderSettings } from './provider-settings'

type AiProviderPageProps = {
  provider: ProviderDetail
  editable: boolean
}

type Asked = 'remove' | 'discover' | 'add'

export function AiProviderPage({ provider, editable }: AiProviderPageProps) {
  const t = useTranslations('adminAiProvider')
  const shared = useTranslations('adminAi')
  const common = useTranslations('admin')
  const format = useAiFormat()
  const navigate = useNavigate()
  const [asked, setAsked] = useState<Asked>()
  const remove = useProviderChange({ revalidate: false })
  const discover = useProviderChange()
  const found = discover.settled?.ok === true ? discover.settled.result : undefined
  const closing = (kind: Asked) => (open: boolean) => setAsked(open ? kind : undefined)
  const { stats } = provider
  return (
    <GatewayFrame
      tab="providers"
      head={
        <ProviderHead provider={provider} editable={editable} onRemove={() => setAsked('remove')} />
      }
    >
      <Stack gap="lg">
        <Alert tone="info" open={!editable}>
          {shared('readOnly')}
        </Alert>
        <StatFigures
          figures={[
            { label: t('stat.requests'), value: format.count(stats.requests) },
            { label: shared('stat.failureRate'), value: format.rate(stats) },
            { label: shared('stat.firstToken'), value: format.latency(stats.first_token_ms) },
            { label: t('stat.cost'), value: format.usd(stats.cost_usd) },
          ]}
        />
        <ProviderRoutes
          provider={provider}
          editable={editable}
          onAdd={() => setAsked('add')}
          onDiscover={() => {
            setAsked('discover')
            void discover.run({ action: 'discover', id: provider.id })
          }}
        />
        <ProviderSettings key={provider.updated} provider={provider} editable={editable} />
      </Stack>
      <DiscoveryDialog
        provider={provider}
        discovery={found?.kind === 'discovered' ? found.discovery : undefined}
        loading={discover.pending}
        open={asked === 'discover'}
        onOpenChange={closing('discover')}
      />
      <ManualRouteDialog provider={provider} open={asked === 'add'} onOpenChange={closing('add')} />
      <AlertDialog
        tone="danger"
        title={t('remove.title', { name: provider.name })}
        description={t('remove.description', { count: (provider.routes ?? []).length })}
        confirmText={t('remove.confirm')}
        cancelText={common('cancel')}
        open={asked === 'remove'}
        onOpenChange={closing('remove')}
        onConfirm={async () => {
          await remove.confirm({ action: 'remove', id: provider.id })
          toast.success(t('remove.done', { name: provider.name }))
          void navigate(aiPaths.providers)
        }}
      />
    </GatewayFrame>
  )
}
