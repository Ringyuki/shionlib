import { DataList, Heading, Stack } from '@hina-ui/react'
import { useFormatter } from 'use-intl'
import { GameRow } from '~/features/game'
import type { ReleaseDay } from '../release'

export function ReleaseDays({ days }: { days: readonly ReleaseDay[] }) {
  const format = useFormatter()
  return (
    <Stack gap="xl">
      {days.map(day => (
        <Stack key={day.date} as="section" gap="md" aria-labelledby={`release-${day.date}`}>
          <Heading id={`release-${day.date}`} level={2} size="md" weight="semibold">
            {format.dateTime(new Date(`${day.date}T12:00:00Z`), {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </Heading>
          <DataList
            items={day.games}
            itemKey="id"
            layout="grid"
            gridMin="26rem"
            gridGap="md"
            minHeight={0}
          >
            {({ item }) => <GameRow game={item} />}
          </DataList>
        </Stack>
      ))}
    </Stack>
  )
}
