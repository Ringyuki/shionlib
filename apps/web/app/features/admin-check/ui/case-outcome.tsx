import { DescriptionDetails, DescriptionList, DescriptionTerm, Time } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { PaneSection } from '~/features/admin'
import type { CaseDetail } from '../admin-check'
import { OutcomeTag } from './check-cells'

export function CaseOutcome({ detail }: { detail: CaseDetail }) {
  const t = useTranslations('adminCheck.pane')
  return (
    <PaneSection label={t('review')}>
      <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
        <DescriptionTerm>{t('outcome')}</DescriptionTerm>
        <DescriptionDetails>
          <OutcomeTag scanCase={detail} />
        </DescriptionDetails>
        <DescriptionTerm>{t('reviewer')}</DescriptionTerm>
        <DescriptionDetails>{detail.reviewer?.name ?? t('system')}</DescriptionDetails>
        <DescriptionTerm>{t('reviewed')}</DescriptionTerm>
        <DescriptionDetails>
          <Time value={detail.reviewed_at} />
        </DescriptionDetails>
        <DescriptionTerm>{t('note')}</DescriptionTerm>
        <DescriptionDetails className="break-words whitespace-pre-wrap">
          {detail.review_note === null || detail.review_note === ''
            ? t('noNote')
            : detail.review_note}
        </DescriptionDetails>
      </DescriptionList>
    </PaneSection>
  )
}
