import { Inline } from '@hina-ui/react'
import { Download, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import type { ResourceSummary } from '~/features/resource'
import { keepScroll, sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import { gamePath, type GameHeader } from '../game'
import { GameMoreMenu } from './game-more-menu'

type GameActionsProps = {
  game: GameHeader
  resources: ResourceSummary
  favorite: ReactNode
}

export function GameActions({ game, resources, favorite }: GameActionsProps) {
  const t = useTranslations('game.actions')
  const locale = useLocale()
  const available = resources.count > 0
  const uploadPath = `${sitePaths(locale).upload}?game=${game.id}`
  return (
    <Inline gap="sm">
      {available && (
        <Button asChild>
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
      )}
      <Button asChild loginRequired variant={available ? 'soft' : 'solid'}>
        <Link to={uploadPath}>
          <Upload aria-hidden />
          {t('upload')}
        </Link>
      </Button>
      {favorite}
      <GameMoreMenu game={game} />
    </Inline>
  )
}
