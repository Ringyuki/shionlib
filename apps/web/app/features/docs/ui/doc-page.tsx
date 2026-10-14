import { Link, Stack } from '@hina-ui/react'
import { ArrowLeft } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { docsPath, type Doc, type DocAuthor, type DocLink } from '../docs'
import { DocHead } from './doc-head'
import { DocView } from './doc-view'

type DocPageProps = {
  doc: Doc
  authors: DocAuthor[]
  previous: DocLink | undefined
  next: DocLink | undefined
}

export function DocPage({ doc, authors, previous, next }: DocPageProps) {
  const t = useTranslations('docs')
  const locale = useLocale()
  return (
    <Stack gap="md" className="@container">
      <Link
        asChild
        tone="neutral"
        className="text-muted inline-flex items-center gap-1.5 self-start"
      >
        <RouterLink to={docsPath(locale)} prefetch="intent">
          <ArrowLeft aria-hidden className="size-4" />
          {t('title')}
        </RouterLink>
      </Link>
      <Stack as="article" gap="xl">
        <DocHead doc={doc} authors={authors} />
        <DocView doc={doc} previous={previous} next={next} />
      </Stack>
    </Stack>
  )
}
