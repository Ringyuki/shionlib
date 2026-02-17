import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'

interface NamesProps {
  form: UseFormReturn<CharacterScalar>
}

export const Names = ({ form }: NamesProps) => {
  const t = useTranslations('Components.Character.Edit.Scalar')
  return (
    <div className="flex flex-col gap-4">
      <FormField
        control={form.control}
        name="name_jp"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('name_jp')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="name_zh"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('name_zh')}</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="name_en"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('name_en')}</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
