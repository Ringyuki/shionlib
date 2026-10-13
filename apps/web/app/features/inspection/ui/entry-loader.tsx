import { Button, Inline, Spinner, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { EntryPage, Place, View } from '../inspection'
import { useEntryPage } from '../use-entry-page'

type EntryLoaderProps = {
  view: View
  place: Place
  onLoaded: (parent: number | null, page: EntryPage) => void
}

export function EntryLoader({ view, place, onLoaded }: EntryLoaderProps) {
  const t = useTranslations('inspection.contents')
  const { failed, retry } = useEntryPage(view, place, page => onLoaded(place.parent, page))
  if (failed) {
    return (
      <Button size="sm" variant="outline" tone="neutral" onClick={retry}>
        {t('retry')}
      </Button>
    )
  }
  return (
    <Inline as="span" gap="sm" align="center" wrap={false}>
      <Spinner size="sm" />
      <Text as="span" size="sm" tone="muted">
        {t('loading')}
      </Text>
    </Inline>
  )
}
