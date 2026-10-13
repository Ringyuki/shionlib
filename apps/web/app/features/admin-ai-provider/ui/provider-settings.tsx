import {
  Form,
  FormField,
  Grid,
  Input,
  Inline,
  NumberInput,
  Panel,
  PasswordInput,
  toast,
} from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { rangeOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import {
  settingsChanges,
  settingsOf,
  type Provider,
  type SettingsDraft,
} from '../admin-ai-provider'
import { settingsForm } from '../admin-ai-provider.schema'
import { useProviderChange } from '../use-provider-change'
import { EndpointField } from './endpoint-field'

type ProviderSettingsProps = {
  provider: Provider
  editable: boolean
}

export function ProviderSettings({ provider, editable }: ProviderSettingsProps) {
  const t = useTranslations('adminAiProvider')
  const kit = useFormKit()
  const [draft, setDraft] = useState(() => settingsOf(provider))
  const change = useProviderChange()
  const form = useFormErrors(change.failure)
  const changes = settingsChanges(provider, draft)
  const set = (next: Partial<SettingsDraft>) => setDraft({ ...draft, ...next })
  return (
    <Panel title={t('settings.title')}>
      <Form
        ref={form}
        values={draft}
        rules={settingsForm(kit)}
        onSubmit={async () => {
          const outcome = await change.run({ action: 'update', id: provider.id, changes })
          if (outcome.ok) {
            set({ apiKey: '' })
            toast.success(t('settings.saved'))
          }
        }}
      >
        <Grid gap="md" className="sm:grid-cols-2">
          <FormField name="name" label={t('field.name')}>
            <Input disabled={!editable} value={draft.name} onValueChange={name => set({ name })} />
          </FormField>
          <FormField label={t('field.multiplier')} description={t('field.multiplierHint')}>
            <NumberInput
              {...rangeOf('AiProviderUpdateInputBody', 'price_multiplier')}
              controls={false}
              stepSnapping={false}
              disabled={!editable}
              formatOptions={{ maximumFractionDigits: 4 }}
              value={draft.priceMultiplier}
              onValueChange={value => set({ priceMultiplier: value ?? null })}
            />
          </FormField>
          <EndpointField
            kind={provider.kind}
            value={draft.baseUrl}
            active
            disabled={!editable}
            onChange={baseUrl => set({ baseUrl })}
          />
          <FormField name="apiKey" label={t('field.apiKey')} description={t('field.apiKeyOnce')}>
            <PasswordInput
              autoComplete="off"
              disabled={!editable}
              placeholder={t('field.apiKeyKept', { hint: provider.key_hint })}
              value={draft.apiKey}
              onValueChange={apiKey => set({ apiKey })}
            />
          </FormField>
        </Grid>
        <Inline>
          <Button
            type="submit"
            loading={change.pending}
            disabled={!editable || Object.keys(changes).length === 0}
          >
            {t('settings.save')}
          </Button>
        </Inline>
      </Form>
    </Panel>
  )
}
