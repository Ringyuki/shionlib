import { Alert, CheckboxGroup, FormField, Inline, Input, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { TwoLines } from '~/features/admin'
import { protocolName, usePriceText } from '~/features/admin-ai'
import { Button } from '~/shared/ui/button'
import { oncePerProvider, type CatalogModel } from '../admin-ai-model'

export type AddDraft = {
  name: string
  description: string
  providers: number[]
}

type ModelAddFieldsProps = {
  model: CatalogModel
  draft: AddDraft
  onChange: (changes: Partial<AddDraft>) => void
  onBack: () => void
}

export function ModelAddFields({ model, draft, onChange, onBack }: ModelAddFieldsProps) {
  const t = useTranslations('adminAiModel.add')
  const price = usePriceText()
  const offers = oncePerProvider(model.offers)
  return (
    <Stack gap="md">
      <Inline gap="md" align="center" justify="between" wrap={false}>
        <TwoLines first={model.name} second={model.canonical_id} mono />
        <Button size="sm" variant="outline" tone="neutral" onClick={onBack}>
          {t('back')}
        </Button>
      </Inline>
      <FormField name="name" label={t('name')} required>
        <Input value={draft.name} onValueChange={name => onChange({ name })} />
      </FormField>
      <FormField name="description" label={t('description')}>
        <Input
          placeholder={t('optional')}
          value={draft.description}
          onValueChange={description => onChange({ description })}
        />
      </FormField>
      <Alert tone="info" open={offers.length === 0}>
        {t('noRoutes')}
      </Alert>
      {offers.length > 0 && (
        <FormField label={t('routes')} description={t('routesHint')}>
          <CheckboxGroup
            block
            value={draft.providers}
            options={offers.map(offer => ({
              value: offer.provider.id,
              label: offer.provider.name,
              description: t('offer', {
                upstream: offer.upstream_id,
                protocol: protocolName(offer.protocol),
                price: price(offer.input_price, offer.output_price),
              }),
            }))}
            onValueChange={picked =>
              onChange({
                providers: offers.map(offer => offer.provider.id).filter(id => picked.includes(id)),
              })
            }
          />
        </FormField>
      )}
    </Stack>
  )
}
