import { Inline, Link, Stack, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import { labelOf } from '~/shared/i18n/labels'
import { useBytes } from '~/shared/i18n/use-bytes'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import {
  changedValues,
  eventChanges,
  eventFiles,
  type EventChange,
  type ResourceEvent,
} from '../resource-page'
import { HistoryChange } from './history-change'

export function HistoryEntry({ event }: { event: ResourceEvent }) {
  const t = useTranslations('resource.page.history')
  const locale = useLocale()
  const format = useFormatter()
  const bytes = useBytes()
  const labels = useMessages()
  const { actor } = event
  const valuesOf = (change: EventChange, values: readonly string[] | null) => {
    const shown = changedValues(values).map(value => {
      switch (change.field) {
        case 'platforms':
          return labelOf(labels.game.platform, value)
        case 'languages':
          return labelOf(labels.game.language, value)
        case 'simulator':
          return labelOf(labels.resource.simulatorName, value)
        case 'note':
          return value
      }
    })
    return shown.length === 0 ? t('none') : format.list(shown)
  }
  return (
    <Stack gap="xs">
      <Inline gap="sm" align="center" className="gap-y-0.5">
        <Text as="span">
          {t.rich(`did.${event.kind}`, {
            actor: () =>
              actor === null ? (
                t('someone')
              ) : (
                <Link asChild tone="neutral" className="font-medium">
                  <RouterLink to={profilePath(locale, actor.id)}>{actor.name}</RouterLink>
                </Link>
              ),
          })}
        </Text>
        <Text as="span" size="sm" tone="faint">
          {format.dateTime(new Date(event.created), { dateStyle: 'long', timeStyle: 'short' })}
        </Text>
      </Inline>
      {event.kind === 'file_renamed' ? (
        <HistoryChange before={event.old_name} after={event.name} />
      ) : (
        event.name !== null && (
          <Text size="sm" tone="muted" className="break-all">
            {event.name}
          </Text>
        )
      )}
      {event.reason !== null && <BBCodeText source={event.reason} size="sm" />}
      {event.old_size !== null && event.new_size !== null && (
        <HistoryChange before={bytes(event.old_size)} after={bytes(event.new_size)} />
      )}
      {eventFiles(event).map(file => (
        <Inline key={file.name} gap="sm" align="center" className="gap-y-0.5">
          <Text as="span" size="sm" tone="muted" className="break-all">
            {file.name}
          </Text>
          <Text as="span" size="sm" tone="faint" className="tabular-nums">
            {bytes(file.size)}
          </Text>
        </Inline>
      ))}
      {eventChanges(event).map(change => (
        <HistoryChange
          key={change.field}
          label={t(`field.${change.field}`)}
          before={valuesOf(change, change.old)}
          after={valuesOf(change, change.new)}
        />
      ))}
    </Stack>
  )
}
