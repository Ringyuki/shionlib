'use client'

import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'

interface SponsorOrderListFiltersProps {
  status: string | undefined
  onStatusChange: (value: string | undefined) => void
}

export function SponsorOrderListFilters({ status, onStatusChange }: SponsorOrderListFiltersProps) {
  const t = useTranslations('Admin.Sponsors')

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={status ?? 'all'}
        onValueChange={v => onStatusChange(v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('allStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          <SelectItem value="NEW">{t('statusNew')}</SelectItem>
          <SelectItem value="DONE">{t('statusDone')}</SelectItem>
          <SelectItem value="EXPIRED">{t('statusExpired')}</SelectItem>
          <SelectItem value="REFUND">{t('statusRefund')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
