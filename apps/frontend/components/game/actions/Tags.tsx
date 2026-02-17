import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { TagsInput } from '@/components/shionui/TagsInput'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'

interface TagsProps {
  form: UseFormReturn<GameScalar>
}

export const Tags = ({ form }: TagsProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="tags"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('tags')}</FormLabel>
          <FormControl>
            <TagsInput {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
