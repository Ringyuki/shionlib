import { Stack, Tag, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import type { Report } from '../admin-report'
import { levelFrom, statusFrom } from '../admin-report.schema'

type ReportStatusProps = {
  report: Pick<Report, 'status' | 'malicious_level' | 'processor' | 'processed_at'>
  credited?: boolean
}

const tones = { PENDING: 'warning', VALID: 'danger', INVALID: 'neutral' } as const

export function ReportStatus({ report, credited = true }: ReportStatusProps) {
  const t = useTranslations('adminReport')
  const format = useFormatter()
  const status = statusFrom(report.status)
  const level = levelFrom(report.malicious_level)
  const label =
    status === undefined
      ? report.status
      : status === 'VALID' && level !== undefined
        ? t('validAt', { level: t(`level.${level}`) })
        : t(`status.${status}`)
  return (
    <Stack gap="none" align="start">
      <Tag tone={status === undefined ? 'neutral' : tones[status]}>{label}</Tag>
      {credited && report.processor !== null && report.processed_at !== null && (
        <Text as="span" size="xs" tone="muted" className="max-md:hidden">
          {t('processedBy', {
            name: report.processor.name,
            date: format.dateTime(new Date(report.processed_at), {
              month: 'short',
              day: 'numeric',
            }),
          })}
        </Text>
      )}
    </Stack>
  )
}
