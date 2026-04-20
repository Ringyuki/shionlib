'use client'

import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import type { ReactNode } from 'react'

interface TypeProps {
  form: UseFormReturn<GameScalar>
  syncAction?: ReactNode
}

export const Type = ({ form, syncAction }: TypeProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('type')}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Input {...field} className="min-w-0 flex-1" />
              {syncAction && <div className="shrink-0">{syncAction}</div>}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
