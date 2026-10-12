import { Grid, PageHeader, Section, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { grouped, type Doc } from '../docs'
import { DocCard } from './doc-card'

type DocsPageProps = {
  docs: readonly Doc[]
}

export function DocsPage({ docs }: DocsPageProps) {
  const t = useTranslations('docs')
  return (
    <Stack gap="xl">
      <PageHeader title={t('title')} />
      {grouped(docs).map(group => (
        <Section key={group.category} title={t(`category.${group.category}`)}>
          <Grid className="gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.docs.map(doc => (
              <DocCard key={doc.name} doc={doc} />
            ))}
          </Grid>
        </Section>
      ))}
    </Stack>
  )
}
