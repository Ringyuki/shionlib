import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'

interface BloodTypeProps {
  form: UseFormReturn<CharacterScalar>
}

const BLOOD_TYPES = ['a', 'b', 'ab', 'o'] as const

export const BloodType = ({ form }: BloodTypeProps) => {
  const t = useTranslations('Components.Character.Edit.Scalar')

  return (
    <FormField
      control={form.control}
      name="blood_type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('blood_type')}</FormLabel>
          <FormControl>
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('blood_type_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {t(`blood_type_${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
