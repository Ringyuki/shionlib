import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { InputNumber } from '@/components/shionui/InputNumber'
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'

interface BodyMetricsProps {
  form: UseFormReturn<CharacterScalar>
}

export const BodyMetrics = ({ form }: BodyMetricsProps) => {
  const t = useTranslations('Components.Character.Edit.Scalar')
  return (
    <div className="flex flex-col gap-4">
      <FormLabel>{t('body_metrics')}</FormLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="height"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('height')}</FormLabel>
              <FormControl>
                <InputNumber
                  {...field}
                  min={0}
                  value={field.value ?? null}
                  onChange={value => field.onChange(value ?? null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="weight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('weight')}</FormLabel>
              <FormControl>
                <InputNumber
                  {...field}
                  min={0}
                  value={field.value ?? null}
                  onChange={value => field.onChange(value ?? null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bust"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('bust')}</FormLabel>
              <FormControl>
                <InputNumber
                  {...field}
                  min={0}
                  value={field.value ?? null}
                  onChange={value => field.onChange(value ?? null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="waist"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('waist')}</FormLabel>
              <FormControl>
                <InputNumber
                  {...field}
                  min={0}
                  value={field.value ?? null}
                  onChange={value => field.onChange(value ?? null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="hips"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('hips')}</FormLabel>
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
        <FormField
          control={form.control}
          name="cup"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('cup')}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
