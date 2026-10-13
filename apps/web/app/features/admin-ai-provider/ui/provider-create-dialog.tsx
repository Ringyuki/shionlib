import {
  Combobox,
  Dialog,
  Form,
  FormField,
  Grid,
  Input,
  NumberInput,
  PasswordInput,
  Select,
  toast,
} from '@hina-ui/react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { aiPaths, providerKinds } from '~/features/admin-ai'
import { rangeOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { blankDraft, withPreset, type ProviderDraft } from '../admin-ai-provider'
import { createForm } from '../admin-ai-provider.schema'
import { useProviderChange } from '../use-provider-change'
import { usePresets } from '../use-provider-lookups'
import { EndpointField } from './endpoint-field'

type ProviderCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProviderCreateDialog({ open, onOpenChange }: ProviderCreateDialogProps) {
  const t = useTranslations('adminAiProvider')
  const shared = useTranslations('admin')
  const kinds = useTranslations('adminAi.kind')
  const kit = useFormKit()
  const navigate = useNavigate()
  const [draft, setDraft] = useOpenState(open, () => blankDraft)
  const { presets, loading } = usePresets(open)
  const change = useProviderChange()
  const form = useFormErrors(change.failure)
  const set = (changes: Partial<ProviderDraft>) => setDraft({ ...draft, ...changes })
  return (
    <Dialog
      title={t('create.title')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Form
          ref={form}
          values={draft}
          rules={createForm(kit)}
          onSubmit={async () => {
            const outcome = await change.run({ action: 'create', ...draft })
            if (outcome.ok && outcome.result.kind === 'created') {
              onOpenChange(false)
              toast.success(t('create.done', { name: draft.name.trim() }))
              void navigate(aiPaths.provider(outcome.result.id))
            }
          }}
        >
          <FormField label={t('field.preset')} description={t('field.presetHint')}>
            <Combobox
              clearable
              loading={loading}
              placeholder={t('field.presetPlaceholder')}
              value={draft.presetId}
              options={presets.map(preset => ({ value: preset.id, label: preset.name }))}
              onValueChange={picked =>
                setDraft(
                  withPreset(
                    draft,
                    presets.find(preset => preset.id === picked),
                  ),
                )
              }
            />
          </FormField>
          <Grid gap="md" className="grid-cols-2">
            <FormField name="name" label={t('field.name')} required>
              <Input value={draft.name} onValueChange={name => set({ name })} />
            </FormField>
            <FormField label={t('field.kind')}>
              <Select
                value={draft.kind}
                options={providerKinds.map(kind => ({ value: kind, label: kinds(kind) }))}
                onValueChange={picked =>
                  set({ kind: providerKinds.find(kind => kind === picked) ?? draft.kind })
                }
              />
            </FormField>
          </Grid>
          <EndpointField
            kind={draft.kind}
            value={draft.baseUrl}
            active={open}
            onChange={baseUrl => set({ baseUrl })}
          />
          <Grid gap="md" className="grid-cols-2">
            <FormField
              name="apiKey"
              label={t('field.apiKey')}
              description={t('field.apiKeyOnce')}
              required
            >
              <PasswordInput
                autoComplete="off"
                value={draft.apiKey}
                onValueChange={apiKey => set({ apiKey })}
              />
            </FormField>
            <FormField label={t('field.multiplier')} description={t('field.multiplierHint')}>
              <NumberInput
                {...rangeOf('AiProviderCreateInputBody', 'price_multiplier')}
                controls={false}
                stepSnapping={false}
                formatOptions={{ maximumFractionDigits: 4 }}
                value={draft.priceMultiplier}
                onValueChange={value => set({ priceMultiplier: value ?? null })}
              />
            </FormField>
          </Grid>
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {t('create.submit')}
          </Button>
        </>
      )}
    />
  )
}
