import {
  Avatar,
  AvatarGroup,
  Grid,
  Image,
  Inline,
  Link,
  PageHeader,
  Text,
  useImageResolver,
} from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale } from 'use-intl'
import { sitePaths } from '~/features/shell'
import type { Doc, DocAuthor } from '../docs'
import { docColumns } from './doc-columns'

type DocHeadProps = {
  doc: Doc
  authors: DocAuthor[]
}

export function DocHead({ doc, authors }: DocHeadProps) {
  const locale = useLocale()
  const format = useFormatter()
  const resolveImage = useImageResolver()
  return (
    <Grid gap="none" className={docColumns.head}>
      <PageHeader title={doc.title} description={doc.description} className="min-w-0">
        <Inline gap="sm" align="center">
          {authors.length > 0 && (
            <>
              <AvatarGroup size="sm" max={4}>
                {authors.map(author => (
                  <Avatar
                    key={author.id}
                    name={author.name}
                    src={author.avatar === null ? undefined : resolveImage(author.avatar, 'image')}
                  />
                ))}
              </AvatarGroup>
              <Text as="span" size="sm">
                {format.list(
                  authors.map(author => (
                    <Link key={author.id} asChild tone="neutral" className="font-medium">
                      <RouterLink to={sitePaths(locale).profile(author.id)}>
                        {author.name}
                      </RouterLink>
                    </Link>
                  )),
                  { type: 'conjunction' },
                )}
              </Text>
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
