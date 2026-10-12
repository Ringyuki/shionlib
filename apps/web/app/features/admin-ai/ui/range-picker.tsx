import { SegmentedControl } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { ranges, type Range } from '../admin-ai'

type RangePickerProps = {
  value: Range
  onChange: (range: Range) => void
}

export function RangePicker({ value, onChange }: RangePickerProps) {
  const t = useTranslations('adminAi.range')
  return (
    <SegmentedControl
      size="sm"
      aria-label={t('label')}
      value={value}
      options={ranges.map(range => ({ value: range, label: t(range) }))}
      onValueChange={picked => onChange(ranges.find(range => range === picked) ?? value)}
    />
  )
}
