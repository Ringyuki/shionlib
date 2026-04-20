import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { DatePicker } from '@/components/shionui/DatePicker'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import type { ReactNode } from 'react'

interface ReleaseDateProps {
  form: UseFormReturn<GameScalar>
  syncAction?: ReactNode
}

export const ReleaseDate = ({ form, syncAction }: ReleaseDateProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="release_date"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('release_date')}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <DatePicker {...field} clearable={false} className="min-w-0 flex-1" />
              {syncAction && <div className="shrink-0">{syncAction}</div>}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
