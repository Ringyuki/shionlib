import { Link, Text } from '@hina-ui/react'
import { Suspense } from 'react'
import { Await } from 'react-router'
import { useTranslations } from 'use-intl'
import type { Score, Scores } from '../game'

export function GameRatings({ scores }: { scores: Promise<Scores> }) {
  return (
    <Suspense fallback={null}>
      <Await resolve={scores} errorElement={null}>
        {resolved => <Ratings scores={resolved} />}
      </Await>
    </Suspense>
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
