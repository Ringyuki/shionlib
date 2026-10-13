import { Empty, Timeline } from '@hina-ui/react'
import { History } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { ResourceEvent } from '../resource-page'
import { HistoryEntry } from './history-entry'

export function ResourceHistory({ events }: { events: readonly ResourceEvent[] }) {
  const t = useTranslations('resource.page.history')
  if (events.length === 0) {
    return <Empty icon={<History />} title={t('empty')} />
  }
  return (
    <Timeline
      aria-label={t('label')}
      items={events.map(event => ({ ...event, tone: toneOf(event) }))}
      renderContent={({ item }) => <HistoryEntry event={item} />}
    />
  )
}

function toneOf(event: ResourceEvent) {
  return event.kind === 'published' ? ('neutral' as const) : ('accent' as const)
}
