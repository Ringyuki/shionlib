import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'
import { TagsInput } from '@/components/shionui/TagsInput'

interface AliasesProps {
  form: UseFormReturn<CharacterScalar>
}

export const Aliases = ({ form }: AliasesProps) => {
  const t = useTranslations('Components.Character.Edit.Scalar')
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
