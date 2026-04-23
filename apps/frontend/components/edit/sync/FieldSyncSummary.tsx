import { useTranslations } from 'next-intl'
import { Badge } from '@/components/shionui/Badge'
import type { FieldSyncPreview } from '../types/field-sync'

interface FieldSyncSummaryProps {
  preview: FieldSyncPreview
}

export const FieldSyncSummary = ({ preview }: FieldSyncSummaryProps) => {
  const t = useTranslations('Components.Common.Edit.FieldSync')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge intent="neutral" appearance="soft">
        {t('summary.total', { count: preview.summary.total })}
      </Badge>
      <Badge intent="success" appearance="soft">
        {t('summary.add', { count: preview.summary.add })}
      </Badge>
      <Badge intent="info" appearance="soft">
        {t('summary.update', { count: preview.summary.update })}
      </Badge>
      {preview.summary.unmatched > 0 && (
        <Badge intent="warning" appearance="soft">
          {t('summary.unmatched', { count: preview.summary.unmatched })}
        </Badge>
      )}
    </div>
  )
}
