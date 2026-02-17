import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { TagsInput } from '@/components/shionui/TagsInput'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { DeveloperScalar } from '@/interfaces/developer/developer-scalar.interface'

interface AliasesProps {
  form: UseFormReturn<DeveloperScalar>
}

export const Aliases = ({ form }: AliasesProps) => {
  const t = useTranslations('Components.Developer.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="aliases"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('aliases')}</FormLabel>
          <FormControl>
            <TagsInput {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
