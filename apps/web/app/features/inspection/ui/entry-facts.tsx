import { Inline, Text } from '@hina-ui/react'
import { siteDay } from '~/shared/i18n/site-time'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { Listed } from '../inspection'

export function EntryFacts({ entry }: { entry: Listed }) {
  const bytes = useBytes('short')
  return (
    <Inline as="span" gap="sm" align="center" wrap={false} className="shrink-0">
      <Text as="span" size="sm" className="w-22 text-end whitespace-nowrap tabular-nums">
        {bytes(entry.size)}
      </Text>
      <Text
        as="span"
        size="sm"
        tone="muted"
        className="w-26 text-end whitespace-nowrap tabular-nums max-sm:hidden"
      >
        {entry.modified === null ? '' : siteDay(new Date(entry.modified))}
      </Text>
    </Inline>
  )
}
