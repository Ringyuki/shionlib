import { Alert, Dialog, Flex, SearchInput, Spinner, Stack, Text, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { errorKindOf, protocols } from '~/features/admin-ai'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { discoveredMatching, type Discovery, type ProviderDetail } from '../admin-ai-provider'
import { useProviderChange } from '../use-provider-change'
import { DiscoveryList } from './discovery-list'

type DiscoveryDialogProps = {
  provider: ProviderDetail
  discovery: Discovery | undefined
  loading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DiscoveryDialog({
  provider,
  discovery,
  loading,
  open,
  onOpenChange,
}: DiscoveryDialogProps) {
  const t = useTranslations('adminAiProvider.discovery')
  const shared = useTranslations('admin')
  const kinds = useTranslations('adminAi.errorKind')
  const [selected, setSelected] = useOpenState<string[]>(open, () => [])
  const [query, setQuery] = useOpenState(open, () => '')
  const add = useProviderChange()
  const models = discovery?.models ?? []
  const error = discovery?.error ?? null
  const picked = models.filter(
    model => selected.includes(model.upstream_id) && model.route_id === null,
  )
  return (
    <Dialog
      title={t('title')}
      description={t('description', { name: provider.name })}
      size="xl"
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Stack gap="md">
          <Alert
            tone="danger"
            open={error !== null}
            title={error === null ? undefined : kinds(errorKindOf(error.kind))}
          >
            <Stack gap="xs">
              <Text as="span" size="inherit" className="break-all">
                {error?.message}
              </Text>
              <Text as="span" size="inherit" tone="muted" className="font-mono break-all">
                {error?.detail}
              </Text>
            </Stack>
          </Alert>
          {loading || discovery === undefined ? (
            <Flex align="center" justify="center" className="h-40">
              <Spinner label={t('loading')} />
            </Flex>
          ) : (
            error === null && (
              <>
                <SearchInput
                  aria-label={t('search')}
                  placeholder={t('search')}
                  value={query}
                  onValueChange={setQuery}
                />
                <DiscoveryList
                  models={discoveredMatching(models, query)}
                  selected={selected}
                  onSelectedChange={setSelected}
                />
              </>
            )
          )}
        </Stack>
      )}
      renderFooter={({ close }) => (
        <>
          <Text as="span" size="sm" tone="muted" className="me-auto">
            {discovery === undefined || loading || error !== null
              ? ''
              : t('found', { count: models.length })}
          </Text>
          <Button variant="ghost" tone="neutral" disabled={add.pending} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button
            loading={add.pending}
            disabled={picked.length === 0}
            onClick={async () => {
              const outcome = await add.run({
                action: 'addRoutes',
                id: provider.id,
                items: picked.map(model => ({
                  upstreamId: model.upstream_id,
                  protocol: protocols.find(protocol => protocol === model.protocol) ?? 'chat',
                })),
              })
              if (outcome.ok && outcome.result.kind === 'added') {
                onOpenChange(false)
                toast.success(t('added', { count: outcome.result.added }))
              }
            }}
          >
            {t('add', { count: picked.length })}
          </Button>
        </>
      )}
    />
  )
}
