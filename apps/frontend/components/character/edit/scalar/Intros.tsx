import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { Textarea } from '@/components/shionui/Textarea'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'
import { BBCodeSupported } from '@/components/common/content/BBCodeSupported'

interface IntrosProps {
  form: UseFormReturn<CharacterScalar>
}

export const Intros = ({ form }: IntrosProps) => {
  const t = useTranslations('Components.Character.Edit.Scalar')
  return (
    <div className="flex flex-col gap-2">
      <BBCodeSupported description={t('intro_info_description')} showDescription />
      <FormField
        control={form.control}
        name="intro_zh"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('intro_zh')}</FormLabel>
            <FormControl className="break-all">
              <Textarea {...field} />
            </FormControl>
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
            <FormControl className="break-all">
              <Textarea {...field} />
            </FormControl>
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
            <FormControl className="break-all">
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
