'use client'

import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'

interface TypeProps {
  form: UseFormReturn<GameScalar>
}

export const Type = ({ form }: TypeProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('type')}</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
