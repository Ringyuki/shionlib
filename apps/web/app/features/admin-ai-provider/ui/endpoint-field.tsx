import { FormField, Input } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { officialHosts, type ProviderKind } from '~/features/admin-ai'
import { useEndpoint } from '../use-provider-lookups'

type EndpointFieldProps = {
  kind: ProviderKind
  value: string
  active: boolean
  disabled?: boolean
  onChange: (value: string) => void
}

export function EndpointField({ kind, value, active, disabled, onChange }: EndpointFieldProps) {
  const t = useTranslations('adminAiProvider.field')
  const endpoint = useEndpoint(kind, value, active)
  const official = officialHosts[kind]
  return (
    <FormField
      name="baseUrl"
      label={t('baseUrl')}
      description={
        endpoint === undefined
          ? undefined
          : endpoint === null
            ? t('baseUrlNeeded')
            : t('endpoint', { url: endpoint })
      }
    >
      <Input
        type="url"
        disabled={disabled}
        placeholder={official === '' ? t('baseUrlExample') : t('official', { host: official })}
        value={value}
        onValueChange={onChange}
      />
    </FormField>
  )
}
