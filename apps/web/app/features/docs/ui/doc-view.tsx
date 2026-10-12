import { Anchor, Divider, Inline, Link, PrevNext, PrevNextLink, Prose, Stack } from '@hina-ui/react'
import { Pencil } from 'lucide-react'
import { use } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { PageLink } from '~/shared/route/page-link'
import { SideColumn } from '~/shared/ui/side-column'
import { docPath, sourceUrl, type Doc, type DocLink } from '../docs'
import { readPage } from '../docs-content'
import { DocHead } from './doc-head'
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
    <>
      <Stack as="article" gap="lg" className="min-w-0">
        <DocHead doc={doc} />
        <Prose className="[&_:is(h1,h2,h3,h4)]:scroll-mt-6">
          <Content components={docParts} />
        </Prose>
        <Divider />
        <Inline justify="end">
          <Link href={sourceUrl(locale, doc)} target="_blank" rel="noreferrer" tone="neutral">
            <Inline as="span" gap="xs" align="center" wrap={false} className="text-sm">
              <Pencil aria-hidden className="size-3.5" />
              {t('source')}
            </Inline>
          </Link>
        </Inline>
        <PrevNext>
          {previous !== undefined && (
            <PrevNextLink direction="prev" as={PageLink} href={docPath(locale, previous)}>
              {previous.title}
            </PrevNextLink>
          )}
          {next !== undefined && (
            <PrevNextLink direction="next" as={PageLink} href={docPath(locale, next)}>
              {next.title}
            </PrevNextLink>
          )}
        </PrevNext>
      </Stack>
      <SideColumn className="@max-5xl:hidden">
        <Anchor items={page.sections} />
      </SideColumn>
    </>
  )
}
