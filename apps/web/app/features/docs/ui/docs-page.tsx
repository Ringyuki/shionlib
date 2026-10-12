import { Grid, Heading, PageHeader, Stack } from '@hina-ui/react'
import { useId } from 'react'
import { useTranslations } from 'use-intl'
import { grouped, type Doc, type DocGroup } from '../docs'
import { DocRow } from './doc-row'

type DocsPageProps = {
  docs: readonly Doc[]
}

export function DocsPage({ docs }: DocsPageProps) {
  const t = useTranslations('docs')
  return (
    <Stack gap="lg" className="@container">
      <PageHeader title={t('title')} />
      <Stack gap="none" className="gap-7">
        {grouped(docs).map(group => (
          <DocGroupSection key={group.category} group={group} />
        ))}
      </Stack>
    </Stack>
  )
}

function DocGroupSection({ group }: { group: DocGroup<Doc> }) {
  const t = useTranslations('docs')
  const title = useId()
  return (
    <Stack as="section" gap="none" aria-labelledby={title} className="gap-1.5">
      <Heading level={2} size="lg" id={title}>
        {t(`category.${group.category}`)}
      </Heading>
      <Grid gap="none" className="-mx-2.5 gap-x-7 gap-y-1 @4xl:grid-cols-2">
        {group.docs.map(doc => (
          <DocRow key={doc.name} doc={doc} />
        ))}
      </Grid>
    </Stack>
  )
}
