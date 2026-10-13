import { Autocomplete, Dialog, Form, FormField, Select, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { protocolNames, type Protocol } from '~/features/admin-ai'
import { protocolsFor } from '~/features/admin-ai-route'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { Model, ProviderOption } from '../admin-ai-model'
import { routeForm } from '../admin-ai-model.schema'
import { useModelChange } from '../use-model-change'

type RouteAddDialogProps = {
  model: Model
  providers: ProviderOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const suggestionsShown = 20

type Draft = { providerId: number | undefined; upstreamId: string; protocol: Protocol | undefined }

export function RouteAddDialog({ model, providers, open, onOpenChange }: RouteAddDialogProps) {
  const t = useTranslations('adminAiModel.addRoute')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const taken = (model.routes ?? []).map(route => route.provider.id)
  const free = providers.filter(provider => !taken.includes(provider.id))
  const offeredBy = (id: number | undefined) =>
    protocolsFor(providers.find(provider => provider.id === id)?.protocols, model.moderation)
  const [draft, setDraft] = useOpenState<Draft>(open, () => ({
    providerId: free[0]?.id,
    upstreamId: '',
    protocol: offeredBy(free[0]?.id)[0],
  }))
  const provider = providers.find(candidate => candidate.id === draft.providerId)
  const offered = offeredBy(draft.providerId)
  const typed = draft.upstreamId.trim().toLowerCase()
  const suggestions = (provider?.upstream_ids ?? [])
    .filter(known => known.toLowerCase().includes(typed))
    .slice(0, suggestionsShown)
    .map(known => ({ value: known, label: known }))
  const change = useModelChange()
  const form = useFormErrors(change.failure)
  return (
    <Dialog
      title={t('title')}
      description={t('description', { name: model.name })}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={{ upstreamId: draft.upstreamId }}
          rules={routeForm(kit)}
          onSubmit={async () => {
            if (draft.providerId === undefined || draft.protocol === undefined) {
              return
            }
            const outcome = await change.run({
              action: 'addRoute',
              id: model.id,
              providerId: draft.providerId,
              upstreamId: draft.upstreamId,
              protocol: draft.protocol,
            })
            if (outcome.ok) {
              onOpenChange(false)
              toast.success(t('done'))
            }
          }}
        >
          <FormField
            label={t('provider')}
            description={free.length === 0 ? t('noProvider') : undefined}
          >
            <Select
              disabled={free.length === 0}
              value={draft.providerId}
              options={free.map(option => ({ value: option.id, label: option.name }))}
              onValueChange={picked => {
                const providerId = free.find(option => option.id === picked)?.id
                setDraft({ ...draft, providerId, protocol: offeredBy(providerId)[0] })
              }}
            />
          </FormField>
          <FormField
            name="upstreamId"
            label={t('upstreamId')}
            description={t('upstreamIdHint')}
            required
          >
            <Autocomplete
              className="font-mono"
              options={suggestions}
              value={draft.upstreamId}
              onValueChange={upstreamId => setDraft({ ...draft, upstreamId })}
            />
          </FormField>
          <FormField label={t('protocol')}>
            <Select
              disabled={offered.length < 2}
              value={draft.protocol}
              options={offered.map(known => ({ value: known, label: protocolNames[known] }))}
              onValueChange={value =>
                setDraft({
                  ...draft,
                  protocol: offered.find(known => known === value) ?? draft.protocol,
                })
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
          <Button
            loading={submitting}
            disabled={draft.providerId === undefined || draft.protocol === undefined}
            onClick={() => void form.current?.submit()}
          >
            {t('submit')}
          </Button>
        </>
      )}
    />
  )
}
