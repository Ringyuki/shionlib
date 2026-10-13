import { cn, Image, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale } from 'use-intl'
import { entryLink } from '~/shared/ui/entry-link'
import { docPath, type Doc } from '../docs'

type DocRowProps = {
  doc: Doc
}

export function DocRow({ doc }: DocRowProps) {
  const locale = useLocale()
  return (
    <Link to={docPath(locale, doc)} prefetch="intent" className={cn(entryLink, 'flex gap-4 p-2.5')}>
      <Image src={doc.banner} alt="" ratio={16 / 9} className="w-28 shrink-0 rounded-lg @xl:w-38" />
      <Stack gap="xs" className="min-w-0 flex-1">
        <Text weight="semibold" className="break-words">
          {doc.title}
        </Text>
        <Text size="sm" tone="muted" className="line-clamp-2">
          {doc.description}
        </Text>
      </Stack>
    </Link>
  )
}
