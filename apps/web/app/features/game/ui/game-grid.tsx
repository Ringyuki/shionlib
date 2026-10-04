import { Card, Image, SimpleGrid, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { gameTitle, primaryCover } from '../game'

type GameGridProps = {
  games: readonly Schema<'GameListItemDTO'>[]
}

export function GameGrid({ games }: GameGridProps) {
  const locale = useLocale()
  return (
    <SimpleGrid min="10rem" gap="md">
      {games.map(game => {
        const title = gameTitle(game, locale)
        return (
          <Card key={game.id} padded={false} className="overflow-hidden">
            <Link to={`/${locale}/game/${game.id}`} prefetch="intent">
              <Image src={primaryCover(game)?.url} alt={title} ratio={3 / 4} fit="cover" />
              <Text size="sm" truncate className="p-2">
                {title}
              </Text>
            </Link>
          </Card>
        )
      })}
    </SimpleGrid>
  )
}
