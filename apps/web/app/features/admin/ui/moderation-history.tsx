import { Grid, Inline, Progress, Stack, Text, Time, Timeline } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { topScores, type ModerationRun } from '../admin-moderation'
import { scoresFrom } from '../admin.schema'
import { DecisionTag, useCategoryLabel } from './moderation-verdict'

const tones = { ALLOW: 'neutral', REVIEW: 'warning', BLOCK: 'danger' } as const

function Run({ run }: { run: ModerationRun }) {
  const t = useTranslations('admin.moderation')
  const format = useFormatter()
  const label = useCategoryLabel()
  const scores = topScores(scoresFrom(run.scores_json))
  return (
    <Stack gap="sm" className="min-w-0 pb-2">
      <Inline gap="sm" align="center">
        <DecisionTag decision={run.decision} />
        <Time value={run.created_at} format="relative" className="text-muted text-sm" />
        <Text as="span" size="xs" tone="faint" className="font-mono break-all">
          {run.model}
        </Text>
      </Inline>
      {run.reason !== undefined && run.reason !== '' && (
        <Text as="span" size="sm" className="break-words">
          {run.reason}
        </Text>
      )}
      {run.evidence !== undefined && run.evidence !== '' && (
        <Text as="span" size="sm" tone="muted" className="break-words">
          {t('evidence', { text: run.evidence })}
        </Text>
      )}
      {scores.length > 0 && (
        <Grid
          gap="none"
          className="grid-cols-[7rem_minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-1.5"
        >
          {scores.map(score => (
            <Inline key={score.category} className="contents">
              <Text as="span" size="sm" tone="muted" truncate>
                {label(score.category)}
              </Text>
              <Progress
                size="sm"
                tone={score.value >= 0.5 ? 'warning' : 'accent'}
                value={score.value * 100}
                aria-label={label(score.category)}
              />
              <Text as="span" size="sm" className="text-end tabular-nums">
                {format.number(score.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </Inline>
          ))}
        </Grid>
      )}
    </Stack>
  )
}

export function ModerationHistory({ runs }: { runs: readonly ModerationRun[] }) {
  const t = useTranslations('admin.moderation')
  if (runs.length === 0) {
    return (
      <Text as="span" size="sm" tone="muted">
        {t('none')}
      </Text>
    )
  }
  return (
    <Timeline
      size="sm"
      items={runs.map(run => ({ id: run.id, tone: tones[run.decision], run }))}
      renderContent={({ item }) => <Run run={item.run} />}
    />
  )
}
