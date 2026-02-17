import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { DatePicker } from '@/components/shionui/DatePicker'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'

interface ReleaseDateProps {
  form: UseFormReturn<GameScalar>
}

export const ReleaseDate = ({ form }: ReleaseDateProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="release_date"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('release_date')}</FormLabel>
          <FormControl>
            <DatePicker {...field} clearable={false} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
