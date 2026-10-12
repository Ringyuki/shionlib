import { Dialog, Form, FormField, Input, Select, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { protocolNames, type Protocol } from '~/features/admin-ai'
import { protocolsFor } from '~/features/admin-ai-route'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { ProviderDetail } from '../admin-ai-provider'
import { manualForm } from '../admin-ai-provider.schema'
import { useProviderChange } from '../use-provider-change'
import { useResolved } from '../use-provider-lookups'

type ManualRouteDialogProps = {
  provider: ProviderDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManualRouteDialog({ provider, open, onOpenChange }: ManualRouteDialogProps) {
  const t = useTranslations('adminAiProvider.manual')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const offered = protocolsFor(provider.protocols, false)
  const [upstreamId, setUpstreamId] = useOpenState(open, () => '')
  const [protocol, setProtocol] = useOpenState<Protocol | undefined>(open, () => offered[0])
  const resolved = useResolved(provider.id, upstreamId, open)
  const change = useProviderChange()
  const form = useFormErrors(change.failure)
  const outlook =
    resolved === undefined
      ? undefined
      : resolved.model_name !== null
        ? t('joins', { name: resolved.model_name })
        : resolved.catalog_name !== null
          ? t('known', { name: resolved.catalog_name })
          : t('unknown')
  return (
    <Dialog
      title={t('title')}
      description={t('description', { name: provider.name })}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={{ upstreamId }}
          rules={manualForm(kit)}
          onSubmit={async () => {
            const outcome = await change.run({
              action: 'addRoutes',
              id: provider.id,
              items: [{ upstreamId, protocol: protocol ?? 'chat' }],
            })
            if (!outcome.ok || outcome.result.kind !== 'added') {
              return
            }
            if (outcome.result.added === 0) {
              toast.warning(t('exists'))
              return
            }
            onOpenChange(false)
            toast.success(t('done'))
          }}
        >
          <FormField name="upstreamId" label={t('upstreamId')} description={outlook} required>
            <Input className="font-mono" value={upstreamId} onValueChange={setUpstreamId} />
          </FormField>
          <FormField label={t('protocol')} description={t('protocolHint')}>
            <Select
              disabled={offered.length < 2}
              value={protocol}
              options={offered.map(known => ({ value: known, label: protocolNames[known] }))}
              onValueChange={value =>
                setProtocol(offered.find(known => known === value) ?? protocol)
              }
            />
          </FormField>
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {t('submit')}
          </Button>
        </>
      )}
    />
  )
}
