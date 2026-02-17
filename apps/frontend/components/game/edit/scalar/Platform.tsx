'use client'

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectValue,
} from '@/components/shionui/MultiSelect'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { Platform as GamePlatform, PlatformOptions } from '@/interfaces/game/game.interface'

interface PlatformProps {
  form: UseFormReturn<GameScalar>
}

export const Platform = ({ form }: PlatformProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="platform"
      render={() => (
        <FormItem>
          <FormLabel>{t('platform')}</FormLabel>
          <FormControl>
            <MultiSelect
              value={form.watch('platform')}
              onValueChange={values =>
                form.setValue('platform', values as GamePlatform[], {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
            >
              <MultiSelectTrigger className="w-full">
                <MultiSelectValue
                  placeholder={t('platformPlaceholder')}
                  resolveLabel={v => PlatformOptions.find(p => p.value === v)?.label ?? v}
                />
              </MultiSelectTrigger>
              <MultiSelectContent>
                {PlatformOptions.map(platform => (
                  <MultiSelectItem key={platform.value} value={platform.value}>
                    {platform.label}
                  </MultiSelectItem>
                ))}
              </MultiSelectContent>
            </MultiSelect>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    ></FormField>
  )
}
