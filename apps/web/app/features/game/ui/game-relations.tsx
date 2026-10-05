import { Section, SimpleGrid, Stack, Text } from '@hina-ui/react'
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
      <SimpleGrid min="20rem" gap="md">
        {relations.map(relation => (
          <Stack key={relation.id} gap="xs">
            <Text size="sm" tone="muted">
              {labelOf(labels, relation.relation)}
            </Text>
            <GameRow game={relation.to_game} />
          </Stack>
        ))}
      </SimpleGrid>
    </Section>
  )
}
