import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupIndicator,
} from '@/components/shionui/animated/RadioGroup'
import { Label } from '@/components/shionui/Label'

interface GenderProps {
  form: UseFormReturn<CharacterScalar>
}

const GENDERS = ['m', 'f', 'o', 'a'] as const

export const Gender = ({ form }: GenderProps) => {
  const t = useTranslations('Components.Character.Edit.Scalar')
  const currentGenders = form.watch('gender') || []

  const setGender = (gender: (typeof GENDERS)[number], index: number) => {
    form.setValue(
      'gender',
      currentGenders.map((g, i) => (i === index ? gender : g)),
    )
  }

  return (
    <FormField
      control={form.control}
      name="gender"
      render={() => (
        <FormItem className="gap-4">
          <FormLabel>{t('gender')}</FormLabel>
          <div className="flex flex-col gap-2 flex-wrap">
            {currentGenders.map((gender, index) => (
              <div key={index} className="flex items-center gap-4">
                <FormLabel>{index === 0 ? t('non-spoiler-gender') : t('actual-gender')}</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={gender}
                    onValueChange={value => setGender(value as (typeof GENDERS)[number], index)}
                    className="flex gap-4 flex-wrap"
                  >
                    {GENDERS.map(gender => (
                      <Label key={gender} className="flex items-center gap-x-3">
                        <RadioGroupItem
                          value={gender}
                          className="size-5 rounded-full flex items-center justify-center border"
                        >
                          <RadioGroupIndicator className="size-3 bg-primary rounded-full" />
                        </RadioGroupItem>
                        {t(`gender_${gender}`)}
                      </Label>
                    ))}
                  </RadioGroup>
                </FormControl>
              </div>
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
