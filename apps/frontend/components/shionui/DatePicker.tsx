'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { timeFormat, TimeFormatEnum } from '@/utils/time-format'

import { cn } from '@/utils/cn'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shionui/Popover'
import { Calendar } from '@/components/shionui/Calendar'
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { SupportedLocales } from '@/config/i18n/supported'

type DatePickerProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value?: Date | string | null
  onChange?: (date: Date | null) => void
  placeholder?: string
  dateFormat?: TimeFormatEnum
  locale?: 'zh' | 'en' | 'ja'
  disabled?: boolean
  clearable?: boolean
  popoverAlign?: 'start' | 'center' | 'end'
}

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      placeholder,
      dateFormat = TimeFormatEnum.EEEE_MMM_DD_YYYY,
      locale = 'en',
      disabled = false,
      clearable = true,
      popoverAlign = 'start',
      className,
      ...props
    },
    ref,
  ) => {
    const t = useTranslations('Components.ShionUI.DatePicker')
    const intlLocale = useLocale() as SupportedLocales
    const [open, setOpen] = React.useState(false)
    const [selectedDate, setSelectedDate] = React.useState<Date | null>(() => {
      if (!value) return null
      if (value instanceof Date) return value
      const parsed = new Date(value)
      return isNaN(parsed.getTime()) ? null : parsed
    })

    React.useEffect(() => {
      if (!value) {
        setSelectedDate(null)
        return
      }
      const newDate = value instanceof Date ? value : new Date(value)
      if (!isNaN(newDate.getTime())) {
        setSelectedDate(newDate)
      }
    }, [value])

    const handleSelect = (date: Date | undefined) => {
      const newDate = date || null
      setSelectedDate(newDate)
      onChange?.(newDate)
      setOpen(false)
    }

    const handleClear = () => {
      setSelectedDate(null)
      onChange?.(null)
    }

    const currentLocale = intlLocale || (locale as SupportedLocales)
    const displayValue = selectedDate ? timeFormat(selectedDate, currentLocale, dateFormat) : ''

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className={cn('relative', className)}>
            <Input
              ref={ref}
              readOnly
              disabled={disabled}
              value={displayValue}
              placeholder={placeholder || t('pickADate')}
              clearable={clearable && !!selectedDate}
              onClear={handleClear}
              suffix={<CalendarIcon className="size-4 pointer-events-none" aria-hidden="true" />}
              className={cn(
                'cursor-pointer',
                !selectedDate && 'text-muted-foreground',
                disabled && 'cursor-not-allowed',
              )}
              onClick={() => !disabled && setOpen(true)}
              {...props}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={popoverAlign}>
          <Calendar
            mode="single"
            selected={selectedDate || undefined}
            defaultMonth={selectedDate || new Date()}
            startMonth={new Date(1970, 0)}
            endMonth={new Date(new Date().getFullYear() + 2, 11)}
            captionLayout="dropdown"
            onSelect={handleSelect}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    )
  },
)

DatePicker.displayName = 'DatePicker'

export { DatePicker }
export type { DatePickerProps }
