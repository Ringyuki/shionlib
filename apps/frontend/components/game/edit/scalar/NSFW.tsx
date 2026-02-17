'use client'

import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { FormField, FormItem, FormLabel, FormControl } from '@/components/shionui/Form'
import { Switch } from '@/components/shionui/animated/Switch'

interface NSFWProps {
  form: UseFormReturn<GameScalar>
}

export const NSFW = ({ form }: NSFWProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="nsfw"
      render={({ field }) => (
        <FormItem className="flex items-center gap-2">
          <FormLabel>{t('nsfw')}</FormLabel>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} className=""></Switch>
          </FormControl>
        </FormItem>
      )}
    />
  )
}
