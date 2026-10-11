import { Inline, Mark, Tag, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { matchParts, notedOf, type Listed } from '../inspection'
import { EntryIcon } from './entry-icon'

type EntryNameProps = {
  entry: Listed
  open: boolean
  query: string
}

export function EntryName({ entry, open, query }: EntryNameProps) {
  const t = useTranslations('inspection.contents')
  const format = useFormatter()
  const track = entry.kind === 'track'
  const name = track
    ? t('track', { number: String(entry.track?.number ?? 0).padStart(2, '0') })
    : entry.name
  const [before, hit, after] = matchParts(name, track ? '' : query)
  const noted = notedOf(entry, {
    duration: length => t('duration', length),
    items: count => t('items', { count: format.number(count) }),
  })
  return (
    <Inline as="span" gap="sm" align="center" className="min-w-0 gap-y-0.5">
      <Inline as="span" gap="sm" align="center" wrap={false} className="max-w-full min-w-0">
        <EntryIcon entry={entry} open={open} />
        <Text
          as="span"
          size="sm"
          tone={entry.preview === null ? undefined : 'accent'}
          className="min-w-0 truncate"
        >
          {before}
          {hit !== '' && <Mark>{hit}</Mark>}
          {after}
        </Text>
      </Inline>
      {entry.location !== undefined && entry.location !== '' && (
        <Text as="span" size="xs" tone="faint" className="max-w-full min-w-0 truncate">
          {entry.location}
        </Text>
      )}
      {noted !== '' && (
        <Text as="span" size="xs" tone="faint" className="shrink-0 tabular-nums">
          {noted}
        </Text>
      )}
      {entry.kind === 'archive' && (
        <Tag size="sm" tone="neutral" className="shrink-0">
          {t('archive')}
        </Tag>
      )}
      {entry.kind === 'disc' && (
        <Tag size="sm" tone="neutral" className="shrink-0">
          {t('disc')}
        </Tag>
      )}
      {entry.encrypted && (
        <Tag size="sm" tone="warning" className="shrink-0">
          {t('encrypted')}
        </Tag>
      )}
      {entry.unreadable && (
        <Text as="span" size="xs" tone="faint" className="shrink-0">
          {t('unreadable')}
        </Text>
      )}
    </Inline>
  )
}
