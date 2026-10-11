import { cn, Image, Inline, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { gameTitle, primaryCover } from '~/features/game'
import { labelOf } from '~/shared/i18n/labels'
import { entryLink } from '~/shared/ui/entry-link'
import { stateOf, walkthroughPath, writingPath, type UserWalkthrough } from '../walkthrough'
import { WalkthroughState } from './walkthrough-state'

type UserWalkthroughRowProps = { walkthrough: UserWalkthrough; own: boolean }

export function UserWalkthroughRow({ walkthrough, own }: UserWalkthroughRowProps) {
  const t = useTranslations('walkthrough')
  const languages = useMessages().walkthrough.language
  const locale = useLocale()
  const { game } = walkthrough
  const target =
    own && stateOf(walkthrough) !== 'published'
      ? writingPath(locale, game.id)
      : walkthroughPath(locale, game.id, walkthrough.id)
  return (
    <Link to={target} prefetch="intent" className={cn(entryLink, 'flex gap-4 p-3')}>
      <Image
        src={primaryCover(game)?.url}
        alt=""
        ratio={3 / 4}
        fit="cover"
        className="w-13.5 shrink-0 rounded-md md:w-15"
      />
      <Stack gap="xs" justify="center" className="min-w-0 flex-1">
        <Inline gap="sm" align="center">
          <Text weight="medium" className="break-words">
            {gameTitle(game, locale)}
          </Text>
          <WalkthroughState walkthrough={walkthrough} />
        </Inline>
        <Inline align="center" className="gap-x-4 gap-y-1">
          <Text size="xs" tone="faint" className="tabular-nums">
            {t('routeCount', { count: walkthrough.route_count })}
          </Text>
          {walkthrough.lang !== null && (
            <Text size="xs" tone="faint">
              {labelOf(languages, walkthrough.lang)}
            </Text>
          )}
          <Text size="xs" tone="faint">
            {t('updated', { date: new Date(walkthrough.updated) })}
          </Text>
        </Inline>
      </Stack>
    </Link>
  )
}
