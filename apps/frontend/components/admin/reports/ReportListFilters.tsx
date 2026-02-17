'use client'

import { InputNumber } from '@/components/shionui/InputNumber'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import { useTranslations } from 'next-intl'
import {
  AdminDownloadResourceReportReason,
  AdminDownloadResourceReportStatus,
  AdminReportMaliciousLevel,
} from '@/interfaces/admin/report.interface'

interface ReportListFiltersProps {
  status: AdminDownloadResourceReportStatus | undefined
  onStatusChange: (value: AdminDownloadResourceReportStatus | undefined) => void
  reason: AdminDownloadResourceReportReason | undefined
  onReasonChange: (value: AdminDownloadResourceReportReason | undefined) => void
  maliciousLevel: AdminReportMaliciousLevel | undefined
  onMaliciousLevelChange: (value: AdminReportMaliciousLevel | undefined) => void
  resourceId: number | undefined
  onResourceIdChange: (value: number | undefined) => void
  reporterId: number | undefined
  onReporterIdChange: (value: number | undefined) => void
  reportedUserId: number | undefined
  onReportedUserIdChange: (value: number | undefined) => void
  sortBy: 'id' | 'created' | 'updated' | 'processed_at'
  onSortByChange: (value: 'id' | 'created' | 'updated' | 'processed_at') => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (value: 'asc' | 'desc') => void
}

const reasons: AdminDownloadResourceReportReason[] = [
  'MALWARE',
  'IRRELEVANT',
  'BROKEN_LINK',
  'MISLEADING_CONTENT',
  'OTHER',
]

const levels: AdminReportMaliciousLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function ReportListFilters({
  status,
  onStatusChange,
  reason,
  onReasonChange,
  maliciousLevel,
  onMaliciousLevelChange,
  resourceId,
  onResourceIdChange,
  reporterId,
  onReporterIdChange,
  reportedUserId,
  onReportedUserIdChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: ReportListFiltersProps) {
  const t = useTranslations('Admin.Reports')

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={status ?? 'all'}
        onValueChange={v =>
          onStatusChange(v === 'all' ? undefined : (v as AdminDownloadResourceReportStatus))
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          <SelectItem value="PENDING">{t('statuses.PENDING')}</SelectItem>
          <SelectItem value="VALID">{t('statuses.VALID')}</SelectItem>
          <SelectItem value="INVALID">{t('statuses.INVALID')}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={reason ?? 'all'}
        onValueChange={v =>
          onReasonChange(v === 'all' ? undefined : (v as AdminDownloadResourceReportReason))
        }
      >
        <SelectTrigger className="w-[190px]">
          <SelectValue placeholder={t('reason')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allReasons')}</SelectItem>
          {reasons.map(item => (
            <SelectItem key={item} value={item}>
              {t(`reasons.${item}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={maliciousLevel ?? 'all'}
        onValueChange={v =>
          onMaliciousLevelChange(v === 'all' ? undefined : (v as AdminReportMaliciousLevel))
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('maliciousLevel')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allLevels')}</SelectItem>
          {levels.map(item => (
            <SelectItem key={item} value={item}>
              {t(`levels.${item}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <InputNumber
        className="w-[140px]"
        value={resourceId ?? null}
        onChange={value => onResourceIdChange(value ?? undefined)}
        placeholder={t('resourceId')}
        min={1}
        clampOnBlur
        showIncrement={false}
        showDecrement={false}
      />

      <InputNumber
        className="w-[140px]"
        value={reporterId ?? null}
        onChange={value => onReporterIdChange(value ?? undefined)}
        placeholder={t('reporterId')}
        min={1}
        clampOnBlur
        showIncrement={false}
        showDecrement={false}
      />

      <InputNumber
        className="w-[160px]"
        value={reportedUserId ?? null}
        onChange={value => onReportedUserIdChange(value ?? undefined)}
        placeholder={t('reportedUserId')}
        min={1}
        clampOnBlur
        showIncrement={false}
        showDecrement={false}
      />

      <Select
        value={sortBy}
        onValueChange={v => onSortByChange(v as 'id' | 'created' | 'updated' | 'processed_at')}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder={t('sortBy')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="id">ID</SelectItem>
          <SelectItem value="created">{t('created')}</SelectItem>
          <SelectItem value="updated">{t('updated')}</SelectItem>
          <SelectItem value="processed_at">{t('processedAt')}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortOrder} onValueChange={v => onSortOrderChange(v as 'asc' | 'desc')}>
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">{t('desc')}</SelectItem>
          <SelectItem value="asc">{t('asc')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
