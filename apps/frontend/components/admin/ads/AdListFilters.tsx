'use client'

import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import { AD_PLACEMENTS } from '@/constants/ad-placements'

const placements = Object.values(AD_PLACEMENTS)

interface AdListFiltersProps {
  placement: string | undefined
  onPlacementChange: (value: string | undefined) => void
  enabled: boolean | undefined
  onEnabledChange: (value: boolean | undefined) => void
}

export function AdListFilters({
  placement,
  onPlacementChange,
  enabled,
  onEnabledChange,
}: AdListFiltersProps) {
  const t = useTranslations('Admin.Ads')

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={placement ?? 'all'}
        onValueChange={v => onPlacementChange(v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={t('allPlacements')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allPlacements')}</SelectItem>
          {placements.map(p => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={enabled === undefined ? 'all' : enabled.toString()}
        onValueChange={v => onEnabledChange(v === 'all' ? undefined : v === 'true')}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('allStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          <SelectItem value="true">{t('enabled')}</SelectItem>
          <SelectItem value="false">{t('disabled')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
