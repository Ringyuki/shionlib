import { Breadcrumb, BreadcrumbItem, BreadcrumbSeparator } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gamePath, gameTitle } from '~/features/game'
import { walkthroughsPath, type GameRef } from '../walkthrough'

export function WalkthroughTrail({ game }: { game: GameRef }) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  return (
    <Breadcrumb>
      <BreadcrumbItem asChild>
        <RouterLink to={gamePath(locale, game.id)}>{gameTitle(game, locale)}</RouterLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem asChild>
        <RouterLink to={walkthroughsPath(locale, game.id)}>{t('list')}</RouterLink>
      </BreadcrumbItem>
    </Breadcrumb>
  )
}
