import { DataList, Section, Stack, Text } from '@hina-ui/react'
import { useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import type { GameDetails } from '../game'
import { GameRow } from './game-row'

export function GameRelations({
  relations,
}: {
  relations: NonNullable<GameDetails['relations_from']>
}) {
  const t = useTranslations('game.info')
  const labels = useMessages().game.relation
  return (
    <Section title={t('relations')}>
      <DataList items={relations} itemKey="id" layout="grid" gridMin="20rem" gridGap="md">
        {({ item }) => (
          <Stack gap="xs">
            <Text size="sm" tone="muted">
              {labelOf(labels, item.relation)}
            </Text>
            <GameRow game={item.to_game} />
          </Stack>
        )}
      </DataList>
    </Section>
  )
}
