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
import type { ReactNode } from 'react'

interface PlatformProps {
  form: UseFormReturn<GameScalar>
  syncAction?: ReactNode
}

export const Platform = ({ form, syncAction }: PlatformProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="platform"
      render={() => (
        <FormItem>
          <FormLabel>{t('platform')}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
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
                <MultiSelectTrigger className="min-w-0 flex-1">
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
              {syncAction && <div className="shrink-0">{syncAction}</div>}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    ></FormField>
  )
}
