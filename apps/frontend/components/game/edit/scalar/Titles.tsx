import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'

interface TitlesProps {
  form: UseFormReturn<GameScalar>
}

export const Titles = ({ form }: TitlesProps) => {
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
              <Input {...field} />
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
