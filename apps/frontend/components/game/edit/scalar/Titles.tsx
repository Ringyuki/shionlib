import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import type { ReactNode } from 'react'

interface TitlesProps {
  form: UseFormReturn<GameScalar>
  syncAction?: ReactNode
}

export const Titles = ({ form, syncAction }: TitlesProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <>
      <FormField
        control={form.control}
        name="title_zh"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('title_zh')}</FormLabel>
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
      <FormField
        control={form.control}
        name="title_en"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('title_en')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="title_jp"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('title_jp')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
