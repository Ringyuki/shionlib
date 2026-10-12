import { PageHeader, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { excludedShown } from '../admin-catalog'
import type { CatalogPage as Loaded } from '../admin-catalog.use-cases'
import { useBangumiOutcome } from '../use-bangumi-outcome'
import { BangumiPanel } from './bangumi-panel'
import { ExcludedPanel } from './excluded-panel'
import { ImportPanel } from './import-panel'
import { SourcesPanel } from './sources-panel'

type CatalogPageProps = Loaded & {
  editable: boolean
}

export function CatalogPage({
  sources,
  excluded,
  excludedTotal,
  page,
  bangumi,
  editable,
}: CatalogPageProps) {
  const t = useTranslations('adminCatalog')
  useBangumiOutcome()
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <SourcesPanel sources={sources} />
      <ImportPanel sources={sources} />
      <ExcludedPanel
        excluded={excluded}
        paging={{ page, pageSize: excludedShown, total: excludedTotal }}
      />
      <BangumiPanel authorization={bangumi} editable={editable} />
    </Stack>
  )
}
