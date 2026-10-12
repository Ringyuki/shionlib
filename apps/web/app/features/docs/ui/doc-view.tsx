import { Divider, Grid, Inline, Link, PrevNext, PrevNextLink, Prose, Stack } from '@hina-ui/react'
import { Pencil } from 'lucide-react'
import { use } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { PageLink } from '~/shared/route/page-link'
import { docPath, sourceUrl, type Doc, type DocLink } from '../docs'
import { readPage } from '../docs-content'
import { docColumns } from './doc-columns'
import { ContentsFold, ContentsRail } from './doc-contents'
import { docParts } from './doc-parts'

type DocViewProps = {
  doc: Doc
  previous: DocLink | undefined
  next: DocLink | undefined
}

export function DocView({ doc, previous, next }: DocViewProps) {
  const t = useTranslations('docs')
  const locale = useLocale()
  const page = use(readPage(locale, doc))
  const Content = page.default
  return (
    <Grid gap="none" className={docColumns.body}>
      <Stack gap="lg" className="min-w-0">
        <ContentsFold sections={page.sections} />
        <Prose className="[&_:is(h1,h2,h3,h4)]:scroll-mt-6">
          <Content components={docParts} />
        </Prose>
        <Divider />
        <Link
          href={sourceUrl(locale, doc)}
          target="_blank"
          rel="noreferrer"
          tone="neutral"
          className="text-muted self-start text-sm"
        >
          <Inline as="span" gap="sm" align="center" wrap={false}>
            <Pencil aria-hidden className="size-3.5" />
            {t('source')}
          </Inline>
        </Link>
        <PrevNext>
          {previous !== undefined && (
            <PrevNextLink
              direction="prev"
              label={t('previous')}
              as={PageLink}
              href={docPath(locale, previous)}
            >
              {previous.title}
            </PrevNextLink>
          )}
          {next !== undefined && (
            <PrevNextLink
              direction="next"
              label={t('next')}
              as={PageLink}
              href={docPath(locale, next)}
            >
              {next.title}
            </PrevNextLink>
          )}
        </PrevNext>
      </Stack>
      <ContentsRail sections={page.sections} />
    </Grid>
  )
}
