import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { DeveloperScalar } from '@/interfaces/developer/developer-scalar.interface'

interface NameProps {
  form: UseFormReturn<DeveloperScalar>
}

export const Name = ({ form }: NameProps) => {
  const t = useTranslations('Components.Developer.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('name')}</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
