import { Avatar, Image, Inline, Link, PageHeader, Stack, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import type { Doc } from '../docs'

type DocHeadProps = {
  doc: Doc
}

export function DocHead({ doc }: DocHeadProps) {
  const t = useTranslations('docs')
  const locale = useLocale()
  const format = useFormatter()
  const { author } = doc
  return (
    <Stack gap="lg">
      {doc.banner !== undefined && (
        <Image src={doc.banner} alt="" ratio={21 / 9} className="rounded-xl" />
      )}
      <PageHeader
        eyebrow={t(`category.${doc.category}`)}
        title={doc.title}
        description={doc.description}
      />
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
    </Stack>
  )
}
