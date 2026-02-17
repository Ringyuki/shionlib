import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { InputNumber } from '@/components/shionui/InputNumber'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'

interface AgeBirthdayProps {
  form: UseFormReturn<CharacterScalar>
}

export const AgeBirthday = ({ form }: AgeBirthdayProps) => {
  const t = useTranslations('Components.Character.Edit.Scalar')
  const birthday = form.watch('birthday') || []

  return (
    <div className="flex flex-col gap-4">
      <FormField
        control={form.control}
        name="age"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('age')}</FormLabel>
            <FormControl>
              <InputNumber
                min={0}
                {...field}
                value={field.value ?? null}
                onChange={value => field.onChange(value ?? null)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormItem>
        <FormLabel>{t('birthday')}</FormLabel>
        <div className="flex gap-2">
          <FormControl>
            <InputNumber
              min={1}
              max={12}
              placeholder={t('birthday_month')}
              value={birthday[0] ?? null}
              onChange={value =>
                form.setValue('birthday', value ? [value, birthday[1] ?? null] : [])
              }
            />
          </FormControl>
          <FormControl>
            <InputNumber
              min={1}
              max={31}
              placeholder={t('birthday_day')}
              value={birthday[1] ?? null}
              onChange={value =>
                form.setValue('birthday', value ? [birthday[0] ?? null, value] : [])
              }
            />
          </FormControl>
        </div>
        <FormMessage />
      </FormItem>
    </div>
  )
}
