import { FormField, FormItem, FormLabel, FormMessage } from '@/components/shionui/Form'
import { BBCodeEditor } from '@/components/common/content/bbcode/BBCodeEditor'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { BBCodeSupported } from '@/components/common/content/bbcode/BBCodeSupported'
import type { ReactNode } from 'react'

interface IntrosProps {
  form: UseFormReturn<GameScalar>
  syncAction?: ReactNode
}

export const Intros = ({ form, syncAction }: IntrosProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <div className="flex flex-col gap-2">
      <BBCodeSupported description={t('intro_info_description')} showDescription />
      <FormField
        control={form.control}
        name="intro_zh"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('intro_zh')}</FormLabel>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <BBCodeEditor value={field.value} onValueChange={field.onChange} />
              </div>
              {syncAction && <div className="shrink-0">{syncAction}</div>}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="intro_en"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('intro_en')}</FormLabel>
            <BBCodeEditor value={field.value} onValueChange={field.onChange} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="intro_jp"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('intro_jp')}</FormLabel>
            <BBCodeEditor value={field.value} onValueChange={field.onChange} />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
