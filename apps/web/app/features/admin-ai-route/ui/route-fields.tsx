import { FormField, Grid, Input, NumberInput, Select, Stack, Switch } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { protocolNames, protocols as known } from '~/features/admin-ai'
import { rangeOf } from '~/shared/form/form-kit'
import { protocolsFor, type Route, type RouteDraft } from '../admin-ai-route'

type RouteFieldsProps = {
  route: Route
  draft: RouteDraft
  protocols: readonly string[] | null | undefined
  onChange: (changes: Partial<RouteDraft>) => void
}

export function RouteFields({ route, draft, protocols, onChange }: RouteFieldsProps) {
  const t = useTranslations('adminAiRoute.edit')
  const offered = protocolsFor(protocols, route.model.moderation)
  const choices = offered.includes(draft.protocol) ? offered : [draft.protocol, ...offered]
  const price = (key: 'inputPrice' | 'outputPrice', field: 'input_price' | 'output_price') => (
    <FormField label={t(key)}>
      <NumberInput
        {...rangeOf('AiRouteUpdateInputBody', field)}
        controls={false}
        stepSnapping={false}
        disabled={!draft.priceManual}
        formatOptions={{ maximumFractionDigits: 6 }}
        value={draft[key]}
        onValueChange={value => onChange({ [key]: value ?? null })}
      />
    </FormField>
  )
  return (
    <Stack gap="md">
      <FormField name="upstreamId" label={t('upstreamId')} description={t('upstreamIdHint')}>
        <Input
          className="font-mono"
          value={draft.upstreamId}
          onValueChange={upstreamId => onChange({ upstreamId })}
        />
      </FormField>
      <FormField label={t('protocol')}>
        <Select
          value={draft.protocol}
          options={choices.map(protocol => ({ value: protocol, label: protocolNames[protocol] }))}
          onValueChange={value =>
            onChange({ protocol: known.find(protocol => protocol === value) ?? draft.protocol })
          }
        />
      </FormField>
      <Switch
        checked={draft.enabled}
        description={route.status === 'suspended' ? t('suspendedHint') : t('enabledHint')}
        onCheckedChange={enabled => onChange({ enabled })}
      >
        {t('enabled')}
      </Switch>
      <Switch
        checked={draft.priceManual}
        description={t('priceManualHint')}
        onCheckedChange={priceManual => onChange({ priceManual })}
      >
        {t('priceManual')}
      </Switch>
      <Grid gap="md" className="grid-cols-2">
        {price('inputPrice', 'input_price')}
        {price('outputPrice', 'output_price')}
      </Grid>
    </Stack>
  )
}
