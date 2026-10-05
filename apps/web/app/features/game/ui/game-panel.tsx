import { Card, Divider, Inline, Stack } from '@hina-ui/react'
import { Download, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import type { ResourceSummary } from '~/features/resource'
import { keepScroll, sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import { CatalogAttribution } from '~/shared/ui/catalog-attribution'
import { gamePath, gameTitle, type GameHeader, type Scores } from '../game'
import { GameCovers } from './game-covers'
import { GameFacts } from './game-facts'
import { GameMoreMenu } from './game-more-menu'

type GamePanelProps = {
  game: GameHeader
  scores: Promise<Scores>
  resources: ResourceSummary
  favorite: ReactNode
  className?: string
}

export function GamePanel({ game, scores, resources, favorite, className }: GamePanelProps) {
  const t = useTranslations('game.actions')
  const locale = useLocale()
  const available = resources.count > 0
  const uploadPath = `${sitePaths(locale).upload}?game=${game.id}`
  return (
    <Card as="aside" padded={false} className={className}>
      <GameCovers
        game={game}
        title={gameTitle(game, locale)}
        className="aspect-[16/10] rounded-none lg:aspect-[3/4]"
        imageClass="object-[50%_22%] lg:object-center"
        fill
      />
      <Stack gap="sm" className="p-4">
        {available ? (
          <Button asChild size="lg" block>
            <Link
              to={{
                pathname: gamePath(locale, game.id),
                hash: resources.first === undefined ? '' : `resource-${resources.first}`,
              }}
              state={keepScroll}
              preventScrollReset
            >
              <Download aria-hidden />
              {t('download', { count: resources.count })}
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" block loginRequired>
            <Link to={uploadPath}>
              <Upload aria-hidden />
              {t('upload')}
            </Link>
          </Button>
        )}
        <Inline gap="sm" wrap={false}>
          {available && (
            <Button asChild variant="soft" loginRequired className="min-w-0 flex-1">
              <Link to={uploadPath} aria-label={t('upload')}>
                <Upload aria-hidden />
                {t('uploadShort')}
              </Link>
            </Button>
          )}
          {favorite}
          <GameMoreMenu game={game} />
        </Inline>
      </Stack>
      <Divider />
      <Stack className="p-4">
        <GameFacts game={game} scores={scores} />
      </Stack>
      {game.h_id !== null && (
        <Inline className="border-t border-line bg-subtle px-4 py-2.5">
          <CatalogAttribution entity="galgame" id={game.h_id} />
        </Inline>
      )}
    </Card>
  )
}
