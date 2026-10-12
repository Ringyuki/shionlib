import { DescriptionDetails, DescriptionList, DescriptionTerm, Time } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { PaneSection } from '~/features/admin'
import type { ReportDetail } from '../admin-report'
import { ReportStatus } from './report-status'

export function ReportOutcome({ detail }: { detail: ReportDetail }) {
  const t = useTranslations('adminReport.review')
  const penalties = [
    detail.reported_penalty_applied ? t('penalty.uploader') : undefined,
    detail.reporter_penalty_applied ? t('penalty.reporter') : undefined,
  ].filter(penalty => penalty !== undefined)
  return (
    <PaneSection label={t('decision')}>
      <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
        <DescriptionTerm>{t('conclusion')}</DescriptionTerm>
        <DescriptionDetails>
          <ReportStatus report={detail} credited={false} />
        </DescriptionDetails>
        <DescriptionTerm>{t('processor')}</DescriptionTerm>
        <DescriptionDetails>{detail.processor?.name ?? t('system')}</DescriptionDetails>
        <DescriptionTerm>{t('processed')}</DescriptionTerm>
        <DescriptionDetails>
          <Time value={detail.processed_at} />
        </DescriptionDetails>
        <DescriptionTerm>{t('note')}</DescriptionTerm>
        <DescriptionDetails className="break-words whitespace-pre-wrap">
          {detail.process_note === null || detail.process_note === ''
            ? t('noDetail')
            : detail.process_note}
        </DescriptionDetails>
        <DescriptionTerm>{t('penalties')}</DescriptionTerm>
        <DescriptionDetails>
          {penalties.length === 0 ? t('penalty.none') : penalties.join(t('separator'))}
        </DescriptionDetails>
      </DescriptionList>
    </PaneSection>
  )
}
