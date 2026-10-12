import { Flex, Inline, Listbox, SearchInput, Spinner, Stack, Tag, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { TwoLines } from '~/features/admin'
import { Capabilities } from '~/features/admin-ai'
import { oncePerProvider, type CatalogModel } from '../admin-ai-model'

type CatalogPickerProps = {
  query: string
  models: CatalogModel[]
  loading: boolean
  loaded: boolean
  onQueryChange: (query: string) => void
  onPick: (model: CatalogModel) => void
}

export function CatalogPicker(props: CatalogPickerProps) {
  const { query, models, loading, loaded, onQueryChange, onPick } = props
  const t = useTranslations('adminAiModel.add')
  return (
    <Stack gap="md">
      <SearchInput
        aria-label={t('search')}
        placeholder={t('search')}
        loading={loading}
        value={query}
        onValueChange={onQueryChange}
      />
      {!loaded ? (
        <Flex align="center" justify="center" className="h-40">
          <Spinner label={t('loading')} />
        </Flex>
      ) : models.length === 0 ? (
        <Flex align="center" justify="center" className="h-40">
          <Text as="span" size="sm" tone="muted">
            {t(query.trim() === '' ? 'noOffers' : 'noMatch')}
          </Text>
        </Flex>
      ) : (
        <Listbox
          aria-label={t('results')}
          maxHeight="22rem"
          value={null}
          options={models.map(model => ({
            value: model.canonical_id,
            label: model.name,
            disabled: model.model_id !== null,
            model,
          }))}
          onValueChange={picked => {
            const model = models.find(candidate => candidate.canonical_id === picked)
            if (model !== undefined) {
              onPick(model)
            }
          }}
          renderOption={({ option }) => (
            <TwoLines first={option.label} second={option.model.canonical_id} mono />
          )}
          renderTrailing={({ option }) => (
            <Inline gap="sm" align="center" wrap={false}>
              <Capabilities of={option.model} />
              {option.model.model_id === null ? (
                <Text as="span" size="sm" tone="muted" className="whitespace-nowrap">
                  {t('offered', { count: oncePerProvider(option.model.offers).length })}
                </Text>
              ) : (
                <Tag tone="neutral">{t('added')}</Tag>
              )}
            </Inline>
          )}
        />
      )}
    </Stack>
  )
}
