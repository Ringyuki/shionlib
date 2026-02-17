'use client'

import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { FormField, FormItem, FormLabel, FormControl } from '@/components/shionui/Form'
import { Switch } from '@/components/shionui/animated/Switch'

interface ReleaseDateTBAProps {
  form: UseFormReturn<GameScalar>
}

export const ReleaseDateTBA = ({ form }: ReleaseDateTBAProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="release_date_tba"
      render={({ field }) => (
        <FormItem className="flex items-center gap-2">
          <FormLabel>{t('release_date_tba')}</FormLabel>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} className=""></Switch>
          </FormControl>
        </FormItem>
      )}
    />
  )
}
