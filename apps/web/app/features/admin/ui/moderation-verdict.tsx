import { Stack, Tag, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import type { Verdict } from '../admin-moderation'
import { categoryFrom } from '../admin.schema'

const tones = { ALLOW: 'neutral', REVIEW: 'warning', BLOCK: 'danger' } as const

export function useCategoryLabel() {
  const t = useTranslations('admin.category')
  return (raw: string) => {
    const category = categoryFrom(raw)
    return category === undefined ? raw : t(category)
  }
}

export function DecisionTag({ decision }: { decision: Verdict['decision'] }) {
  const t = useTranslations('admin.decision')
  return <Tag tone={tones[decision]}>{t(decision)}</Tag>
}

export function ModerationVerdict({ verdict }: { verdict: Verdict | undefined }) {
  const t = useTranslations('admin.moderation')
  const format = useFormatter()
  const label = useCategoryLabel()
  if (verdict === undefined) {
    return (
      <Text as="span" size="sm" tone="muted">
        {t('none')}
      </Text>
    )
  }
  const score =
    verdict.max_score === null
      ? undefined
      : format.number(verdict.max_score, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <Stack gap="none" align="start">
      <DecisionTag decision={verdict.decision} />
      {score !== undefined && (
        <Text as="span" size="xs" tone="muted" className="tabular-nums">
          {verdict.decision === 'ALLOW' || verdict.top_category === ''
            ? t('highest', { score })
            : t('scored', { category: label(verdict.top_category), score })}
        </Text>
      )}
    </Stack>
  )
}
