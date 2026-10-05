import { cn, Grid, Heading, Inline, Link, Stack, Tag, Text, Tooltip } from '@hina-ui/react'
import { Download, Upload } from 'lucide-react'
import { Fragment, Suspense, type ReactNode } from 'react'
import { Await, Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import type { ResourceSummary } from '~/features/resource'
import { keepScroll, sitePaths } from '~/features/shell'
import { labelOf } from '~/shared/i18n/labels'
import { Button } from '~/shared/ui/button'
import { CatalogAttribution } from '~/shared/ui/catalog-attribution'
import {
  bannerIndex,
  gamePath,
  gameTitle,
  originalTitle,
  releaseDate,
  type GameHeader,
  type GameImage,
  type Score,
  type Scores,
} from '../game'
import { GameBanner } from './game-banner'
import { GameCover } from './game-covers'
import { GameMoreMenu } from './game-more-menu'

const shownAliases = 3

type GameHeroProps = {
  game: GameHeader
  images: readonly GameImage[]
  scores: Promise<Scores>
  resources: ResourceSummary
  favorite: ReactNode
}

export function GameHero({ game, images, scores, resources, favorite }: GameHeroProps) {
  const locale = useLocale()
  const title = gameTitle(game, locale)
  const original = originalTitle(game, locale)
  const bannerAt = bannerIndex(images, game.content_limit)
  const banner = bannerAt === undefined ? undefined : images[bannerAt]
  const staged = banner !== undefined
  return (
    <Stack as="header" gap="none">
      {banner !== undefined && (
        <GameBanner image={banner} className="h-44 rounded-2xl sm:h-64 lg:h-80" />
      )}
      <Grid
        className={cn(
          'grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-x-8',
          staged && 'px-2 sm:px-6 lg:px-8',
        )}
      >
        <Stack
          className={cn(
            'relative self-start sm:row-span-2',
            staged && '-mt-12 sm:-mt-20 lg:-mt-24',
          )}
        >
          <GameCover
            game={game}
            title={title}
            className={cn('rounded-xl', staged && 'ring-4 ring-canvas')}
          />
        </Stack>
        <Stack gap="md" className="min-w-0 pt-4 sm:pt-5">
          <Stack gap="xs">
            <Byline game={game} />
            <Heading level={1} size="2xl" weight="semibold" className="text-balance max-sm:text-xl">
              {title}
            </Heading>
            {original !== undefined && (
              <Text tone="muted" className="text-balance sm:text-lg">
                {original}
              </Text>
            )}
            <Aliases aliases={game.aliases ?? []} />
          </Stack>
          <Inline gap="sm" align="center" className="gap-y-2">
            <Chips game={game} />
            <Suspense fallback={null}>
              <Await resolve={scores} errorElement={null}>
                {resolved => <Ratings scores={resolved} />}
              </Await>
            </Suspense>
          </Inline>
        </Stack>
        <Inline
          justify="between"
          align="center"
          gap="md"
          className="col-span-2 gap-y-4 pt-5 sm:col-span-1 sm:col-start-2"
        >
          <Actions game={game} resources={resources} favorite={favorite} />
          {game.h_id !== null && <CatalogAttribution entity="galgame" id={game.h_id} />}
        </Inline>
      </Grid>
    </Stack>
  )
}

function Byline({ game }: { game: GameHeader }) {
  const t = useTranslations('game')
  const locale = useLocale()
  const format = useFormatter()
  const released = game.release_date_tba ? undefined : releaseDate(game)
  const developers = game.developers ?? []
  return (
    <Text size="sm" tone="muted">
      {developers.map(({ developer }, index) => (
        <Fragment key={developer.id}>
          {index > 0 && ' / '}
          <Link asChild className="font-medium">
            <RouterLink to={`/${locale}/developer/${developer.id}`} prefetch="intent">
              {developer.name}
            </RouterLink>
          </Link>
        </Fragment>
      ))}
      {developers.length > 0 && ' · '}
      {released === undefined ? t('releaseTba') : format.dateTime(released, { dateStyle: 'long' })}
    </Text>
  )
}

function Chips({ game }: { game: GameHeader }) {
  const labels = useMessages().game
  return (
    <>
      {(game.platform ?? []).map(platform => (
        <Tag key={platform} size="sm">
          {labelOf(labels.platform, platform)}
        </Tag>
      ))}
      {game.type !== null && game.type !== '' && (
        <Tag size="sm" variant="outline">
          {game.type}
        </Tag>
      )}
    </>
  )
}

function Ratings({ scores }: { scores: Scores }) {
  const t = useTranslations('game.score')
  const rows = [
    { key: 'bangumi', label: t('bangumi'), score: scores.bangumi },
    { key: 'vndb', label: t('vndb'), score: scores.vndb },
  ].flatMap(row => (row.score === undefined ? [] : [{ ...row, score: row.score }]))
  return rows.map(row => <Rating key={row.key} label={row.label} score={row.score} />)
}

function Rating({ label, score }: { label: string; score: Score }) {
  const t = useTranslations('game.score')
  return (
    <Link
      href={score.url}
      target="_blank"
      rel="noreferrer"
      tone="neutral"
      title={t('votes', { source: label, count: score.votes })}
      className="inline-flex items-baseline gap-1.5"
    >
      <Text as="span" size="xs" tone="muted">
        {label}
      </Text>
      <Text as="span" weight="semibold" className="text-inherit tabular-nums">
        {score.value.toFixed(1)}
      </Text>
    </Link>
  )
}

function Aliases({ aliases }: { aliases: readonly string[] }) {
  const t = useTranslations('game.facts')
  if (aliases.length === 0) {
    return null
  }
  const shown = aliases.slice(0, shownAliases)
  const hidden = aliases.length - shown.length
  return (
    <Text size="xs" tone="faint">
      {shown.join(' · ')}
      {hidden > 0 && (
        <>
          {' '}
          <Tooltip content={aliases.join(' · ')}>
            <Text
              as="span"
              size="xs"
              tone="faint"
              tabIndex={0}
              className="cursor-help whitespace-nowrap underline decoration-dotted"
            >
              {t('moreAliases', { count: hidden })}
            </Text>
          </Tooltip>
        </>
      )}
    </Text>
  )
}

function Actions({
  game,
  resources,
  favorite,
}: {
  game: GameHeader
  resources: ResourceSummary
  favorite: ReactNode
}) {
  const t = useTranslations('game.actions')
  const locale = useLocale()
  const available = resources.count > 0
  const uploadPath = `${sitePaths(locale).upload}?game=${game.id}`
  return (
    <Inline gap="sm">
      {available && (
        <Button asChild>
          <RouterLink
            to={{
              pathname: gamePath(locale, game.id),
              hash: resources.first === undefined ? '' : `resource-${resources.first}`,
            }}
            state={keepScroll}
            preventScrollReset
          >
            <Download aria-hidden />
            {t('download', { count: resources.count })}
          </RouterLink>
        </Button>
      )}
      <Button asChild loginRequired variant={available ? 'soft' : 'solid'}>
        <RouterLink to={uploadPath}>
          <Upload aria-hidden />
          {t('upload')}
        </RouterLink>
      </Button>
      {favorite}
      <GameMoreMenu game={game} />
    </Inline>
  )
}
