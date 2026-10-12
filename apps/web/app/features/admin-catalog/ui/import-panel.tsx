import { Inline, Panel, SearchInput, SegmentedControl, Select } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useSourceName } from '~/features/admin'
import { entities, maxQueryLength, type Entity, type Source } from '../admin-catalog'
import { useCatalogSearch } from '../use-catalog-search'
import { ImportResults } from './import-results'

export function ImportPanel({ sources }: { sources: Source[] }) {
  const t = useTranslations('adminCatalog')
  const sourceName = useSourceName()
  const [source, setSource] = useState(sources[0]?.name ?? '')
  const [entity, setEntity] = useState<Entity>('game')
  const [query, setQuery] = useState('')
  const search = useCatalogSearch({ source, entity, query })
  return (
    <Panel title={t('import.title')} description={t('import.hint')} padded={false}>
      <Inline gap="sm" align="center" className="border-line border-t px-(--hn-panel-p) py-3">
        <Select
          size="sm"
          aria-label={t('import.source')}
          className="w-36"
          value={source}
          options={sources.map(known => ({ value: known.name, label: sourceName(known.name) }))}
          onValueChange={value => setSource(String(value ?? source))}
        />
        <SegmentedControl
          size="sm"
          aria-label={t('import.entity')}
          value={entity}
          options={entities.map(kind => ({ value: kind, label: t(`entity.${kind}`) }))}
          onValueChange={value => setEntity(entities.find(kind => kind === value) ?? entity)}
        />
        <SearchInput
          size="sm"
          aria-label={t('import.search')}
          placeholder={t('import.search')}
          className="w-72 max-sm:w-full"
          maxLength={maxQueryLength}
          loading={search.waiting}
          value={query}
          onValueChange={setQuery}
        />
      </Inline>
      <ImportResults found={search.found} state={search.state} onChanged={search.reload} />
    </Panel>
  )
}
