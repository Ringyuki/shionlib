import { Image, Inline, Link, Skeleton, Stack, Text } from '@hina-ui/react'
import { Suspense } from 'react'
import { Await } from 'react-router'
import { useTranslations } from 'use-intl'
import type { Score, Scores, ScoreSite, ScoreSource } from '../game-score'
import VndbLogo from './vndb-logo.svg?react'

type GameScoresProps = {
  sites: readonly ScoreSite[]
  scores: Promise<Scores>
}

export function GameScores({ sites, scores }: GameScoresProps) {
  if (sites.length === 0) {
    return null
  }
  return (
    <Suspense fallback={<ScoreList sites={sites} />}>
      <Await resolve={scores} errorElement={<ScoreList sites={sites} scores={{}} />}>
        {resolved => <ScoreList sites={sites} scores={resolved} />}
      </Await>
    </Suspense>
  )
}

function ScoreList({ sites, scores }: { sites: readonly ScoreSite[]; scores?: Scores }) {
  return (
    <Inline gap="lg" wrap={false} className="items-start">
      {sites.map(site => (
        <SiteScore
          key={site.source}
          site={site}
          score={scores?.[site.source]}
          loading={scores === undefined}
        />
      ))}
    </Inline>
  )
}

type SiteScoreProps = {
  site: ScoreSite
  score: Score | undefined
  loading: boolean
}

function SiteScore({ site, score, loading }: SiteScoreProps) {
  const t = useTranslations('game.score')
  return (
    <Link
      href={site.url}
      target="_blank"
      rel="noreferrer"
      tone="neutral"
      className="hn-state-layer -m-2 block min-w-28 rounded-lg p-2"
    >
      <Stack gap="xs">
        <SiteLogo source={site.source} label={t(site.source)} />
        <Text size="xl" weight="semibold" className="leading-tight tabular-nums">
          {score === undefined ? '—' : score.value.toFixed(1)}
        </Text>
        <Skeleton loading={loading}>
          <Text size="xs" tone="muted">
            {score === undefined ? t('none') : t('votes', { count: score.votes })}
          </Text>
        </Skeleton>
      </Stack>
    </Link>
  )
}

function SiteLogo({ source, label }: { source: ScoreSource; label: string }) {
  if (source === 'vndb') {
    return (
      <VndbLogo
        role="img"
        aria-label={label}
        className="h-6 w-[calc(1.5rem*103/42)] shrink-0 self-start"
      />
    )
  }
  return (
    <Image
      src="/brand/bangumi-logo.png"
      alt={label}
      ratio={270 / 70}
      fit="contain"
      eager
      lazy={false}
      skeleton={false}
      className="w-[5.8rem]"
    />
  )
}
