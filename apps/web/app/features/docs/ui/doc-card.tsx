import { Card, Image, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useFormatter, useLocale } from 'use-intl'
import { docPath, type Doc } from '../docs'

type DocCardProps = {
  doc: Doc
}

export function DocCard({ doc }: DocCardProps) {
  const locale = useLocale()
  const format = useFormatter()
  return (
    <Card padded={false} className="hn-interactive h-full overflow-hidden">
      <Link to={docPath(locale, doc)} prefetch="intent" className="block h-full">
        {doc.banner !== undefined && <Image src={doc.banner} alt="" ratio={16 / 9} />}
        <Stack gap="xs" className="p-4">
          <Text weight="medium" className="line-clamp-2">
            {doc.title}
          </Text>
          <Text size="sm" tone="muted" className="line-clamp-2">
            {doc.description}
          </Text>
          <Text size="xs" tone="faint" className="tabular-nums">
            {format.dateTime(new Date(doc.date), { dateStyle: 'long' })}
          </Text>
        </Stack>
      </Link>
    </Card>
  )
}
