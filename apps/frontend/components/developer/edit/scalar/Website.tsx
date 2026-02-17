import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { DeveloperScalar } from '@/interfaces/developer/developer-scalar.interface'

interface WebsiteProps {
  form: UseFormReturn<DeveloperScalar>
}

export const Website = ({ form }: WebsiteProps) => {
  const t = useTranslations('Components.Developer.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="website"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('website')}</FormLabel>
          <FormControl>
            <Input {...field} placeholder="https://..." />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
