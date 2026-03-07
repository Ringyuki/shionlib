import { FormField, FormItem, FormLabel, FormMessage } from '@/components/shionui/Form'
import { BBCodeEditor } from '@/components/common/content/bbcode/BBCodeEditor'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { DeveloperScalar } from '@/interfaces/developer/developer-scalar.interface'
import { BBCodeSupported } from '@/components/common/content/bbcode/BBCodeSupported'

interface IntrosProps {
  form: UseFormReturn<DeveloperScalar>
}

export const Intros = ({ form }: IntrosProps) => {
  const t = useTranslations('Components.Developer.Edit.Scalar')
  return (
    <div className="flex flex-col gap-2">
      <BBCodeSupported description={t('intro_info_description')} showDescription />
      <FormField
        control={form.control}
        name="intro_zh"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('intro_zh')}</FormLabel>
            <BBCodeEditor value={field.value} onValueChange={field.onChange} />
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
