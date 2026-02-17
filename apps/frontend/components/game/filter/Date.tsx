import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/shionui/MultiSelect'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarIcon } from 'lucide-react'

interface DateFilterProps {
  onYearChange: (year: number[]) => void
  onMonthChange: (month: number[]) => void
  yearValue?: number[]
  monthValue?: number[]
}

export const DateFilter = ({
  onYearChange,
  onMonthChange,
  yearValue,
  monthValue,
}: DateFilterProps) => {
  const t = useTranslations('Components.Game.Filter.Date')
  const [year, setYear] = useState<number[]>(yearValue ?? [])
  const [month, setMonth] = useState<number[]>(monthValue ?? [])
  const years = Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() - i).toString())
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
  const handleYearChange = (year: number[]) => {
    setYear(year)
    onYearChange(year)
  }
  const handleMonthChange = (month: number[]) => {
    setMonth(month)
    onMonthChange(month)
  }
  return (
    <div className="flex flex-col gap-2 max-w-full md:min-w-64">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <CalendarIcon className="size-3.5" />
        {t('date')}
      </div>
      <div className="flex gap-2">
        <MultiSelect defaultValue={yearValue} value={year} onValueChange={handleYearChange}>
          <MultiSelectTrigger className="w-64 text-base">
            <MultiSelectValue placeholder={t('selectYear')} resolveLabel={v => v} />
          </MultiSelectTrigger>
          <MultiSelectContent>
            {years.map(year => (
              <MultiSelectItem key={year} value={year}>
                {year}
              </MultiSelectItem>
            ))}
          </MultiSelectContent>
        </MultiSelect>
        <MultiSelect defaultValue={monthValue} value={month} onValueChange={handleMonthChange}>
          <MultiSelectTrigger className="w-64 text-base" disabled={year.length === 0}>
            <MultiSelectValue placeholder={t('selectMonth')} resolveLabel={v => v} />
          </MultiSelectTrigger>
          <MultiSelectContent>
            {months.map(month => (
              <MultiSelectItem key={month} value={month}>
                {month}
              </MultiSelectItem>
            ))}
          </MultiSelectContent>
        </MultiSelect>
      </div>
    </div>
  )
}
