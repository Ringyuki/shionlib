import { Avatar, Grid, Image, Inline, Link, PageHeader, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale } from 'use-intl'
import { sitePaths } from '~/features/shell'
import type { Doc } from '../docs'
import { docColumns } from './doc-columns'

type DocHeadProps = {
  doc: Doc
}

export function DocHead({ doc }: DocHeadProps) {
  const locale = useLocale()
  const format = useFormatter()
  const { author } = doc
  return (
    <Grid gap="none" className={docColumns.head}>
      <PageHeader title={doc.title} description={doc.description} className="min-w-0">
        <Inline gap="sm" align="center">
          {author !== undefined && (
            <>
              <Avatar size="sm" name={author.name} src={author.avatar} />
              {author.id === undefined ? (
                <Text size="sm" weight="medium">
                  {author.name}
                </Text>
              ) : (
                <Link asChild tone="neutral" className="text-sm font-medium">
                  <RouterLink to={sitePaths(locale).profile(author.id)}>{author.name}</RouterLink>
                </Link>
              )}
            </>
          )}
          <Text size="sm" tone="muted" className="tabular-nums">
            {format.dateTime(new Date(doc.date), { dateStyle: 'long' })}
          </Text>
        </Inline>
      </PageHeader>
      {doc.banner !== undefined && (
        <Image
          src={doc.banner}
          alt=""
          ratio={16 / 9}
          lazy={false}
          eager
          className="rounded-xl @max-xl:order-first"
        />
      )}
    </Grid>
  )
}
