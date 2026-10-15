import { Link, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { ImageSource } from '../search-image'

export function ImageCredit({ source }: { source: ImageSource | null }) {
  const t = useTranslations('search.image')
  if (source === null) {
    return null
  }
  return (
    <Text as="span" size="xs" tone="muted">
      {t.rich('credit', {
        name: source.name,
        source: chunks => (
          <Link href={source.url} target="_blank" rel="noreferrer">
            {chunks}
          </Link>
        ),
      })}
    </Text>
  )
}
