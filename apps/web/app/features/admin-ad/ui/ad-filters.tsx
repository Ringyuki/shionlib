import { Inline, SegmentedControl, Select } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { slots, statuses, type Filter } from '../admin-ad'

const every = 'all'

type AdFiltersProps = {
  filter: Filter
  onChange: (changes: Partial<Filter>) => void
}

export function AdFilters({ filter, onChange }: AdFiltersProps) {
  const t = useTranslations('adminAd')
  return (
    <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
      <SegmentedControl
        size="sm"
        aria-label={t('filter.status')}
        value={filter.status ?? every}
        options={[
          { value: every, label: t('filter.all') },
          ...statuses.map(status => ({ value: status, label: t(`status.${status}`) })),
        ]}
        onValueChange={value =>
          onChange({ status: statuses.find(status => status === value), ad: undefined })
        }
      />
      <Select
        size="sm"
        aria-label={t('filter.slot')}
        className="ms-auto w-40"
        value={filter.slot ?? every}
        options={[
          { value: every, label: t('filter.allSlots') },
          ...slots.map(slot => ({ value: slot, label: t(`slot.${slot}`) })),
        ]}
        onValueChange={value =>
          onChange({ slot: slots.find(slot => slot === value), ad: undefined })
        }
      />
    </Inline>
  )
}
