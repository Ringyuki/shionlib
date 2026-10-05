import { DescriptionDetails, DescriptionList, DescriptionTerm, Link, Text } from '@hina-ui/react'
import { Fragment, Suspense, type ReactNode } from 'react'
import { Await, Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import { releaseDate, type GameHeader, type Score, type Scores } from '../game'

type Fact = { key: string; term: string; details: ReactNode }

const listClass =
  'grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5 text-sm [&>dd]:m-0! [&>dd]:text-end [&>dt]:m-0!'

export function GameFacts({ game, scores }: { game: GameHeader; scores: Promise<Scores> }) {
  const t = useTranslations('game')
  const labels = useMessages().game
  const locale = useLocale()
  const format = useFormatter()
  const released = game.release_date_tba ? undefined : releaseDate(game)
  const developers = game.developers ?? []
  const platforms = (game.platform ?? []).map(platform => labelOf(labels.platform, platform))
  const facts: Fact[] = [
    {
      key: 'released',
      term: t('meta.released'),
      details:
        released === undefined ? t('releaseTba') : format.dateTime(released, { dateStyle: 'long' }),
    },
    ...(developers.length === 0
      ? []
      : [
          {
            key: 'developers',
            term: t('meta.developers'),
            details: developers.map(({ developer }, index) => (
              <Fragment key={developer.id}>
                {index > 0 && ' / '}
                <Link asChild>
                  <RouterLink to={`/${locale}/developer/${developer.id}`} prefetch="intent">
                    {developer.name}
                  </RouterLink>
                </Link>
              </Fragment>
            )),
          },
        ]),
    ...(platforms.length === 0
      ? []
      : [{ key: 'platforms', term: t('meta.platforms'), details: platforms.join(' · ') }]),
    ...(game.type === null || game.type === ''
      ? []
      : [{ key: 'type', term: t('meta.type'), details: game.type }]),
  ]
  return (
    <DescriptionList className={listClass}>
      {facts.map(fact => (
        <FactRow key={fact.key} fact={fact} />
      ))}
      <Suspense fallback={null}>
        <Await resolve={scores} errorElement={null}>
          {resolved => <ScoreRows scores={resolved} />}
        </Await>
      </Suspense>
    </DescriptionList>
  )
}

function FactRow({ fact }: { fact: Fact }) {
  return (
    <>
      <DescriptionTerm className="font-normal text-muted">{fact.term}</DescriptionTerm>
      <DescriptionDetails className="break-words text-fg">{fact.details}</DescriptionDetails>
    </>
  )
}

function ScoreRows({ scores }: { scores: Scores }) {
  const t = useTranslations('game.score')
  const rows = [
    { key: 'bangumi', label: t('bangumi'), score: scores.bangumi },
    { key: 'vndb', label: t('vndb'), score: scores.vndb },
  ].flatMap(row => (row.score === undefined ? [] : [{ ...row, score: row.score }]))
  return rows.map(row => (
    <FactRow
      key={row.key}
      fact={{
        key: row.key,
        term: row.label,
        details: <ScoreValue label={row.label} score={row.score} />,
      }}
    />
  ))
}

function ScoreValue({ label, score }: { label: string; score: Score }) {
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
      <Text as="span" weight="semibold" className="text-inherit tabular-nums">
        {score.value.toFixed(1)}
      </Text>
      <Text as="span" size="xs" tone="faint" className="tabular-nums">
        {t('count', { count: score.votes })}
      </Text>
    </Link>
  )
}
